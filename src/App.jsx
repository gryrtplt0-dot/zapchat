/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
import { useEffect, useRef, useState } from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { auth, db } from "./firebase";
import "./App.css";

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

function RemoteAudio({ stream }) {
  const audioRef = useRef(null);

  useEffect(() => {
    if (audioRef.current && stream) {
      audioRef.current.srcObject = stream;
    }
  }, [stream]);

  return <audio ref={audioRef} autoPlay playsInline />;
}

function App() {
  const [username, setUsername] = useState(() => {
    return localStorage.getItem("zapchat-username") || "Guest";
  });

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [servers, setServers] = useState([]);
  const [activeServerId, setActiveServerId] = useState(null);

  const [activeChannel, setActiveChannel] = useState("general");
  const [messageText, setMessageText] = useState("");
  const [messages, setMessages] = useState([]);
  const [members, setMembers] = useState([]);
  const [memberError, setMemberError] = useState("");

  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState("");
  const [isSending, setIsSending] = useState(false);

  const [serverModalOpen, setServerModalOpen] = useState(false);
  const [serverModalMode, setServerModalMode] = useState(null);
  const [newServerName, setNewServerName] = useState("");
  const [joinInviteCode, setJoinInviteCode] = useState("");
  const [serverModalError, setServerModalError] = useState("");
  const [serverActionLoading, setServerActionLoading] = useState(false);

  const [voiceJoined, setVoiceJoined] = useState(false);
  const [voiceJoining, setVoiceJoining] = useState(false);
  const [voiceMuted, setVoiceMuted] = useState(false);
  const [voiceParticipants, setVoiceParticipants] = useState([]);
  const [voiceStatus, setVoiceStatus] = useState("Sese katılmadın.");
  const [voiceError, setVoiceError] = useState("");
  const [remoteStreams, setRemoteStreams] = useState([]);

  const messagesEndRef = useRef(null);
  const localStreamRef = useRef(null);
  const peerConnectionsRef = useRef(new Map());
  const pendingIceCandidatesRef = useRef(new Map());
  const signalUnsubscribeRef = useRef(null);
  const participantDocRef = useRef(null);
  const voiceRoomIdRef = useRef(null);
  const voiceJoinedRef = useRef(false);
  const voiceMutedRef = useRef(false);

  const channels = [
    { id: "general", name: "genel" },
    { id: "gaming", name: "oyun" },
    { id: "study", name: "ders" },
    { id: "random", name: "rastgele" },
  ];

  const activeServer =
    servers.find((server) => server.id === activeServerId) || null;

  const isActiveServerOwner =
    activeServer &&
    currentUser &&
    activeServer.createdByUid === currentUser.uid;

  const activeChannelName =
    channels.find((channel) => channel.id === activeChannel)?.name || "genel";

  const filteredMessages = messages.filter(
    (message) => message.channel === activeChannel
  );

  const activeVoiceParticipants = voiceParticipants.filter(
    (participant) => participant.serverId === activeServerId
  );

  function getCurrentTime() {
    const now = new Date();
    const hour = String(now.getHours()).padStart(2, "0");
    const minute = String(now.getMinutes()).padStart(2, "0");
    return `${hour}:${minute}`;
  }

  function getServerInitial(serverName) {
    return (serverName || "Z").charAt(0).toUpperCase();
  }

  function getUserInitial(displayName) {
    return (displayName || "G").charAt(0).toUpperCase();
  }

  function getMemberDocumentId(serverId, uid) {
    return `${serverId}_${uid}`;
  }

  function getVoiceRoomId(serverId) {
    return `${serverId}_main_voice`;
  }

  function generateInviteCode() {
    const firstPart = Math.random().toString(36).slice(2, 6).toUpperCase();
    const secondPart = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `${firstPart}-${secondPart}`;
  }

  async function createUniqueInviteCode() {
    for (let attempt = 0; attempt < 10; attempt++) {
      const code = generateInviteCode();
      const codeRef = doc(db, "inviteCodes", code);
      const codeSnap = await getDoc(codeRef);

      if (!codeSnap.exists()) {
        return code;
      }
    }

    throw new Error("Davet kodu üretilemedi.");
  }

  async function saveMemberProfile(serverId, role) {
    if (!currentUser || !serverId) {
      return;
    }

    const cleanUsername = username.trim() || "Guest";
    const memberRef = doc(
      db,
      "members",
      getMemberDocumentId(serverId, currentUser.uid)
    );

    const memberSnap = await getDoc(memberRef);

    if (memberSnap.exists()) {
      await updateDoc(memberRef, {
        displayName: cleanUsername,
        email: currentUser.email,
        updatedAt: serverTimestamp(),
      });

      return;
    }

    await setDoc(memberRef, {
      serverId,
      uid: currentUser.uid,
      email: currentUser.email,
      displayName: cleanUsername,
      role,
      joinedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  function openServerModal() {
    setServerModalOpen(true);
    setServerModalMode(null);
    setNewServerName("");
    setJoinInviteCode("");
    setServerModalError("");
  }

  function resetServerModal() {
    setServerModalOpen(false);
    setServerModalMode(null);
    setNewServerName("");
    setJoinInviteCode("");
    setServerModalError("");
  }

  function closeServerModal() {
    if (serverActionLoading) {
      return;
    }

    resetServerModal();
  }

  function getReadableAuthError(error) {
    if (error.code === "auth/email-already-in-use") {
      return "Bu e-posta zaten kullanılıyor.";
    }

    if (error.code === "auth/invalid-email") {
      return "E-posta adresi geçersiz.";
    }

    if (error.code === "auth/weak-password") {
      return "Şifre en az 6 karakter olmalı.";
    }

    if (
      error.code === "auth/invalid-credential" ||
      error.code === "auth/wrong-password" ||
      error.code === "auth/user-not-found"
    ) {
      return "E-posta veya şifre yanlış.";
    }

    return "Bir hata oluştu. Firebase ayarlarını kontrol et.";
  }

  async function createAccount(event) {
    event.preventDefault();
    setAuthError("");

    try {
      await createUserWithEmailAndPassword(auth, email.trim(), password);
    } catch (error) {
      console.error("Hesap oluşturulamadı:", error);
      setAuthError(getReadableAuthError(error));
    }
  }

  async function login(event) {
    event.preventDefault();
    setAuthError("");

    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (error) {
      console.error("Giriş yapılamadı:", error);
      setAuthError(getReadableAuthError(error));
    }
  }

  async function logout() {
    await leaveVoiceRoom();
    await signOut(auth);
  }

  async function createServer(event) {
    event.preventDefault();

    if (!currentUser) {
      return;
    }

    const cleanName = newServerName.trim();

    if (cleanName.length < 2) {
      setServerModalError("Sunucu adı en az 2 karakter olmalı.");
      return;
    }

    if (cleanName.length > 32) {
      setServerModalError("Sunucu adı en fazla 32 karakter olabilir.");
      return;
    }

    try {
      setServerActionLoading(true);
      setServerModalError("");
      setMemberError("");

      const inviteCode = await createUniqueInviteCode();
      const serverRef = doc(collection(db, "servers"));

      await setDoc(serverRef, {
        name: cleanName,
        inviteCode,
        createdByUid: currentUser.uid,
        createdByEmail: currentUser.email,
        createdAt: serverTimestamp(),
      });

      await setDoc(doc(db, "inviteCodes", inviteCode), {
        code: inviteCode,
        serverId: serverRef.id,
        serverName: cleanName,
        createdByUid: currentUser.uid,
        createdAt: serverTimestamp(),
      });

      await setDoc(
        doc(db, "userServers", currentUser.uid, "servers", serverRef.id),
        {
          serverId: serverRef.id,
          serverName: cleanName,
          uid: currentUser.uid,
          email: currentUser.email,
          role: "owner",
          inviteCode,
          joinedAt: serverTimestamp(),
        }
      );

      setActiveServerId(serverRef.id);
      setActiveChannel("general");
      resetServerModal();

      saveMemberProfile(serverRef.id, "owner").catch((error) => {
        console.error("Üye listesi kaydı oluşturulamadı:", error);
        setMemberError(`Üye kaydı yazılamadı: ${error.message}`);
      });

      alert(`Sunucu oluşturuldu.\nDavet kodu: ${inviteCode}`);
    } catch (error) {
      console.error("Sunucu oluşturulamadı:", error);
      setServerModalError(
        "Sunucu oluşturulamadı. Firestore Rules ayarlarını kontrol et."
      );
    } finally {
      setServerActionLoading(false);
    }
  }

  async function joinServer(event) {
    event.preventDefault();

    if (!currentUser) {
      return;
    }

    const cleanCode = joinInviteCode.trim().toUpperCase();

    if (!cleanCode) {
      setServerModalError("Davet kodunu yazmalısın.");
      return;
    }

    try {
      setServerActionLoading(true);
      setServerModalError("");
      setMemberError("");

      const inviteRef = doc(db, "inviteCodes", cleanCode);
      const inviteSnap = await getDoc(inviteRef);

      if (!inviteSnap.exists()) {
        setServerModalError("Bu davet kodu bulunamadı.");
        return;
      }

      const inviteData = inviteSnap.data();
      const serverId = inviteData.serverId;

      const membershipRef = doc(
        db,
        "userServers",
        currentUser.uid,
        "servers",
        serverId
      );

      const membershipSnap = await getDoc(membershipRef);

      if (!membershipSnap.exists()) {
        await setDoc(membershipRef, {
          serverId,
          serverName: inviteData.serverName,
          uid: currentUser.uid,
          email: currentUser.email,
          role: "member",
          inviteCode: cleanCode,
          joinedAt: serverTimestamp(),
        });
      }

      setActiveServerId(serverId);
      setActiveChannel("general");
      resetServerModal();

      saveMemberProfile(serverId, "member").catch((error) => {
        console.error("Üye listesi kaydı oluşturulamadı:", error);
        setMemberError(`Üye kaydı yazılamadı: ${error.message}`);
      });
    } catch (error) {
      console.error("Sunucuya katılınamadı:", error);
      setServerModalError(
        "Sunucuya katılınamadı. Davet kodunu veya Rules ayarlarını kontrol et."
      );
    } finally {
      setServerActionLoading(false);
    }
  }

  async function deleteActiveServer() {
    if (!currentUser || !activeServer) {
      return;
    }

    if (activeServer.createdByUid !== currentUser.uid) {
      alert("Bu sunucuyu sadece sunucu sahibi silebilir.");
      return;
    }

    const shouldDelete = confirm(
      `"${activeServer.name}" sunucusu kalıcı olarak silinsin mi?`
    );

    if (!shouldDelete) {
      return;
    }

    const deletedServerId = activeServer.id;
    const previousServers = servers;
    const previousActiveServerId = activeServerId;

    try {
      const remainingServers = servers.filter(
        (server) => server.id !== deletedServerId
      );

      setServers(remainingServers);
      setActiveServerId(remainingServers[0]?.id || null);
      setActiveChannel("general");
      setMessages([]);
      setMembers([]);

      await updateDoc(doc(db, "servers", deletedServerId), {
        deleted: true,
        deletedAt: serverTimestamp(),
        deletedByUid: currentUser.uid,
      });

      if (activeServer.inviteCode) {
        try {
          await deleteDoc(doc(db, "inviteCodes", activeServer.inviteCode));
        } catch (error) {
          console.warn("Davet kodu silinemedi:", error);
        }
      }
    } catch (error) {
      console.error("Sunucu silinemedi:", error);
      setServers(previousServers);
      setActiveServerId(previousActiveServerId);
      alert("Sunucu silinemedi. Firebase Rules veya bağlantı ayarlarını kontrol et.");
    }
  }

  async function sendMessage(event) {
    event.preventDefault();

    const cleanText = messageText.trim();
    const cleanUsername = username.trim() || "Guest";

    if (cleanText === "" || !currentUser || !activeServerId) {
      return;
    }

    try {
      setIsSending(true);

      await addDoc(collection(db, "messages"), {
        serverId: activeServerId,
        channel: activeChannel,
        user: cleanUsername,
        email: currentUser.email,
        uid: currentUser.uid,
        text: cleanText,
        time: getCurrentTime(),
        createdAt: serverTimestamp(),
      });

      setMessageText("");
    } catch (error) {
      console.error("Mesaj gönderilemedi:", error);
      alert("Mesaj gönderilemedi. Firebase bağlantısını kontrol et.");
    } finally {
      setIsSending(false);
    }
  }

  async function deleteMessage(messageId) {
    const shouldDelete = confirm("Bu mesaj silinsin mi?");

    if (!shouldDelete) {
      return;
    }

    try {
      await deleteDoc(doc(db, "messages", messageId));
    } catch (error) {
      console.error("Mesaj silinemedi:", error);
      alert("Mesaj silinemedi. Sadece kendi mesajlarını silebilirsin.");
    }
  }

  function getVoiceParticipantName(uid) {
    if (uid === currentUser?.uid) {
      return username.trim() || "Guest";
    }

    return (
      voiceParticipants.find((participant) => participant.uid === uid)
        ?.displayName || "Bilinmeyen kullanıcı"
    );
  }

  async function sendVoiceSignal(targetUid, type, payload) {
    if (!voiceRoomIdRef.current || !currentUser) {
      return;
    }

    const signalInboxRef = collection(
      db,
      "voiceRooms",
      voiceRoomIdRef.current,
      "signals",
      targetUid,
      "items"
    );

    await addDoc(signalInboxRef, {
      roomId: voiceRoomIdRef.current,
      fromUid: currentUser.uid,
      fromName: username.trim() || "Guest",
      toUid: targetUid,
      type,
      payload,
      createdAt: serverTimestamp(),
    });
  }

  async function clearVoiceSignalInbox(roomId, uid) {
    const inboxRef = collection(
      db,
      "voiceRooms",
      roomId,
      "signals",
      uid,
      "items"
    );

    const inboxSnapshot = await getDocs(inboxRef);
    const deleteJobs = inboxSnapshot.docs.map((signalDoc) =>
      deleteDoc(signalDoc.ref)
    );

    await Promise.all(deleteJobs);
  }

  async function flushPendingIceCandidates(uid, peerConnection) {
    const pendingCandidates = pendingIceCandidatesRef.current.get(uid) || [];

    if (pendingCandidates.length === 0) {
      return;
    }

    for (const candidate of pendingCandidates) {
      try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        console.warn("Bekleyen ICE candidate eklenemedi:", error);
      }
    }

    pendingIceCandidatesRef.current.delete(uid);
  }

  function removeRemoteStream(uid) {
    setRemoteStreams((previousStreams) =>
      previousStreams.filter((remoteStream) => remoteStream.uid !== uid)
    );
  }

  function closePeerConnection(uid) {
    const peerConnection = peerConnectionsRef.current.get(uid);

    if (peerConnection) {
      peerConnection.onicecandidate = null;
      peerConnection.ontrack = null;
      peerConnection.onconnectionstatechange = null;
      peerConnection.close();
    }

    peerConnectionsRef.current.delete(uid);
    pendingIceCandidatesRef.current.delete(uid);
    removeRemoteStream(uid);
  }

  async function createPeerConnection(remoteUid, shouldCreateOffer) {
    if (!currentUser || !localStreamRef.current || !voiceRoomIdRef.current) {
      return null;
    }

    const existingPeerConnection = peerConnectionsRef.current.get(remoteUid);

    if (existingPeerConnection) {
      return existingPeerConnection;
    }

    const peerConnection = new RTCPeerConnection({
      iceServers: ICE_SERVERS,
    });

    peerConnectionsRef.current.set(remoteUid, peerConnection);

    localStreamRef.current.getTracks().forEach((track) => {
      peerConnection.addTrack(track, localStreamRef.current);
    });

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        sendVoiceSignal(remoteUid, "candidate", event.candidate.toJSON()).catch(
          (error) => {
            console.error("ICE candidate gönderilemedi:", error);
          }
        );
      }
    };

    peerConnection.ontrack = (event) => {
      const [stream] = event.streams;

      if (!stream) {
        return;
      }

      setRemoteStreams((previousStreams) => {
        const withoutOldStream = previousStreams.filter(
          (remoteStream) => remoteStream.uid !== remoteUid
        );

        return [...withoutOldStream, { uid: remoteUid, stream }];
      });

      setVoiceStatus("Ses bağlantısı aktif.");
    };

    peerConnection.onconnectionstatechange = () => {
      const state = peerConnection.connectionState;

      if (state === "connected") {
        setVoiceStatus("Ses bağlantısı aktif.");
        return;
      }

      if (state === "failed" || state === "disconnected" || state === "closed") {
        removeRemoteStream(remoteUid);
      }
    };

    if (shouldCreateOffer) {
      try {
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);

        await sendVoiceSignal(remoteUid, "offer", {
          type: peerConnection.localDescription.type,
          sdp: peerConnection.localDescription.sdp,
        });
      } catch (error) {
        console.error("Ses teklifi oluşturulamadı:", error);
        setVoiceError(
          `${getVoiceParticipantName(remoteUid)} ile ses bağlantısı başlatılamadı.`
        );
      }
    }

    return peerConnection;
  }

  function setupVoiceSignalListener(roomId) {
    if (!currentUser) {
      return;
    }

    if (signalUnsubscribeRef.current) {
      signalUnsubscribeRef.current();
      signalUnsubscribeRef.current = null;
    }

    const inboxRef = collection(
      db,
      "voiceRooms",
      roomId,
      "signals",
      currentUser.uid,
      "items"
    );

    signalUnsubscribeRef.current = onSnapshot(
      inboxRef,
      (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type !== "added") {
            return;
          }

          const signalDoc = change.doc;
          const signal = signalDoc.data();

          if (!signal.fromUid || signal.fromUid === currentUser.uid) {
            deleteDoc(signalDoc.ref).catch((error) => {
              console.warn("Ses sinyali temizlenemedi:", error);
            });
            return;
          }

          async function handleSignal() {
            try {
              const peerConnection =
                peerConnectionsRef.current.get(signal.fromUid) ||
                (await createPeerConnection(signal.fromUid, false));

              if (!peerConnection) {
                return;
              }

              if (signal.type === "offer") {
                await peerConnection.setRemoteDescription(
                  new RTCSessionDescription(signal.payload)
                );
                await flushPendingIceCandidates(signal.fromUid, peerConnection);

                const answer = await peerConnection.createAnswer();
                await peerConnection.setLocalDescription(answer);

                await sendVoiceSignal(signal.fromUid, "answer", {
                  type: peerConnection.localDescription.type,
                  sdp: peerConnection.localDescription.sdp,
                });
              }

              if (signal.type === "answer") {
                if (peerConnection.signalingState !== "stable") {
                  await peerConnection.setRemoteDescription(
                    new RTCSessionDescription(signal.payload)
                  );
                  await flushPendingIceCandidates(signal.fromUid, peerConnection);
                }
              }

              if (signal.type === "candidate") {
                if (peerConnection.remoteDescription?.type) {
                  await peerConnection.addIceCandidate(
                    new RTCIceCandidate(signal.payload)
                  );
                } else {
                  const pendingCandidates =
                    pendingIceCandidatesRef.current.get(signal.fromUid) || [];
                  pendingCandidates.push(signal.payload);
                  pendingIceCandidatesRef.current.set(
                    signal.fromUid,
                    pendingCandidates
                  );
                }
              }
            } catch (error) {
              console.error("Ses sinyali işlenemedi:", error);
              setVoiceError("Ses bağlantısı kurulurken bir hata oluştu.");
            } finally {
              deleteDoc(signalDoc.ref).catch((error) => {
                console.warn("Ses sinyali temizlenemedi:", error);
              });
            }
          }

          handleSignal();
        });
      },
      (error) => {
        console.error("Ses sinyalleri dinlenemedi:", error);
        setVoiceError(`Ses sinyalleri okunamadı: ${error.message}`);
      }
    );
  }

  function stopLocalVoiceStream() {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
  }

  async function leaveVoiceRoom(updateState = true) {
    const participantRef = participantDocRef.current;

    voiceJoinedRef.current = false;

    if (signalUnsubscribeRef.current) {
      signalUnsubscribeRef.current();
      signalUnsubscribeRef.current = null;
    }

    peerConnectionsRef.current.forEach((_, uid) => {
      closePeerConnection(uid);
    });

    peerConnectionsRef.current.clear();
    pendingIceCandidatesRef.current.clear();
    stopLocalVoiceStream();

    participantDocRef.current = null;
    voiceRoomIdRef.current = null;

    if (updateState) {
      setVoiceJoined(false);
      setVoiceJoining(false);
      setRemoteStreams([]);
      setVoiceStatus("Sese katılmadın.");
    }

    if (participantRef) {
      try {
        await deleteDoc(participantRef);
      } catch (error) {
        console.warn("Ses katılımcısı silinemedi:", error);
      }
    }
  }

  async function joinVoiceRoom() {
    if (!currentUser || !activeServerId || voiceJoining || voiceJoined) {
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setVoiceError("Bu tarayıcı mikrofon erişimini desteklemiyor.");
      return;
    }

    const roomId = getVoiceRoomId(activeServerId);

    try {
      setVoiceJoining(true);
      setVoiceError("");
      setVoiceStatus("Mikrofon izni bekleniyor...");

      const localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });

      localStream.getAudioTracks().forEach((track) => {
        track.enabled = !voiceMutedRef.current;
      });

      localStreamRef.current = localStream;
      voiceRoomIdRef.current = roomId;

      await setDoc(
        doc(db, "voiceRooms", roomId),
        {
          serverId: activeServerId,
          channelId: "main_voice",
          name: "Sesli Sohbet",
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      const participantRef = doc(
        db,
        "voiceRooms",
        roomId,
        "participants",
        currentUser.uid
      );

      participantDocRef.current = participantRef;

      await clearVoiceSignalInbox(roomId, currentUser.uid);

      await setDoc(
        participantRef,
        {
          serverId: activeServerId,
          uid: currentUser.uid,
          email: currentUser.email,
          displayName: username.trim() || "Guest",
          muted: voiceMutedRef.current,
          joinedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      setupVoiceSignalListener(roomId);

      voiceJoinedRef.current = true;
      setVoiceJoined(true);
      setVoiceStatus("Ses odasına katıldın.");
    } catch (error) {
      console.error("Ses odasına katılınamadı:", error);
      setVoiceError(
        "Ses odasına katılınamadı. Mikrofon iznini ve Firebase Rules ayarlarını kontrol et."
      );
      await leaveVoiceRoom(true);
    } finally {
      setVoiceJoining(false);
    }
  }

  async function toggleVoiceMute() {
    const nextMuted = !voiceMuted;

    voiceMutedRef.current = nextMuted;
    setVoiceMuted(nextMuted);

    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !nextMuted;
      });
    }

    if (participantDocRef.current) {
      try {
        await updateDoc(participantDocRef.current, {
          muted: nextMuted,
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        console.warn("Mikrofon durumu güncellenemedi:", error);
      }
    }
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!currentUser) {
      setServers([]);
      setActiveServerId(null);
      setMessages([]);
      setMembers([]);
      return;
    }

    const membershipsRef = collection(
      db,
      "userServers",
      currentUser.uid,
      "servers"
    );

    let serverUnsubscribers = [];

    function clearServerUnsubscribers() {
      serverUnsubscribers.forEach((unsubscribeServer) => unsubscribeServer());
      serverUnsubscribers = [];
    }

    const unsubscribeMemberships = onSnapshot(
      membershipsRef,
      (snapshot) => {
        clearServerUnsubscribers();

        const serverMap = new Map();

        function rebuildServers() {
          const cleanServers = Array.from(serverMap.values())
            .filter(Boolean)
            .sort((a, b) => {
              const aTime = a.createdAt?.toMillis?.() || 0;
              const bTime = b.createdAt?.toMillis?.() || 0;
              return aTime - bTime;
            });

          setServers(cleanServers);
        }

        if (snapshot.empty) {
          setServers([]);
          setActiveServerId(null);
          setMessages([]);
          setMembers([]);
          return;
        }

        snapshot.docs.forEach((membershipDoc) => {
          const membershipData = membershipDoc.data();
          const serverId = membershipData.serverId || membershipDoc.id;
          const serverRef = doc(db, "servers", serverId);

          const unsubscribeServer = onSnapshot(
            serverRef,
            (serverSnap) => {
              if (!serverSnap.exists()) {
                serverMap.delete(serverId);
                rebuildServers();
                return;
              }

              const serverData = serverSnap.data();

              if (serverData.deleted === true) {
                serverMap.delete(serverId);
                rebuildServers();
                return;
              }

              serverMap.set(serverId, {
                id: serverSnap.id,
                role: membershipData.role || "member",
                ...serverData,
              });

              rebuildServers();
            },
            (error) => {
              console.error("Sunucu bilgisi okunamadı:", error);
            }
          );

          serverUnsubscribers.push(unsubscribeServer);
        });
      },
      (error) => {
        console.error("Sunucular okunamadı:", error);
      }
    );

    return () => {
      unsubscribeMemberships();
      clearServerUnsubscribers();
    };
  }, [currentUser]);

  useEffect(() => {
    if (servers.length === 0) {
      if (activeServerId !== null) {
        setActiveServerId(null);
      }

      setActiveChannel("general");
      return;
    }

    const stillExists = servers.some((server) => server.id === activeServerId);

    if (!stillExists) {
      setActiveServerId(servers[0].id);
      setActiveChannel("general");
    }
  }, [servers, activeServerId]);

  useEffect(() => {
    if (!currentUser || !activeServer) {
      return;
    }

    const role =
      activeServer.createdByUid === currentUser.uid
        ? "owner"
        : activeServer.role || "member";

    saveMemberProfile(activeServer.id, role).catch((error) => {
      console.error("Üye profili senkronize edilemedi:", error);
      setMemberError(`Üye kaydı yazılamadı: ${error.message}`);
    });
  }, [currentUser, activeServer, username]);

  useEffect(() => {
    if (!currentUser || !activeServerId) {
      setMessages([]);
      return;
    }

    const messagesCollection = collection(db, "messages");
    const messagesQuery = query(
      messagesCollection,
      where("serverId", "==", activeServerId)
    );

    const unsubscribe = onSnapshot(
      messagesQuery,
      (snapshot) => {
        const firebaseMessages = snapshot.docs.map((document) => {
          return {
            id: document.id,
            ...document.data(),
          };
        });

        firebaseMessages.sort((a, b) => {
          const aTime = a.createdAt?.toMillis?.() || 0;
          const bTime = b.createdAt?.toMillis?.() || 0;
          return aTime - bTime;
        });

        setMessages(firebaseMessages);
      },
      (error) => {
        console.error("Mesajlar okunamadı:", error);
        alert("Mesajlar okunamadı. Firebase Rules ayarlarını kontrol et.");
      }
    );

    return () => unsubscribe();
  }, [currentUser, activeServerId]);

  useEffect(() => {
    if (!currentUser || !activeServerId) {
      setMembers([]);
      return;
    }

    const membersCollection = collection(db, "members");
    const membersQuery = query(
      membersCollection,
      where("serverId", "==", activeServerId)
    );

    const unsubscribe = onSnapshot(
      membersQuery,
      (snapshot) => {
        const firebaseMembers = snapshot.docs.map((memberDoc) => {
          return {
            id: memberDoc.id,
            ...memberDoc.data(),
          };
        });

        firebaseMembers.sort((a, b) => {
          if (a.role === "owner" && b.role !== "owner") {
            return -1;
          }

          if (a.role !== "owner" && b.role === "owner") {
            return 1;
          }

          return (a.displayName || "").localeCompare(b.displayName || "");
        });

        setMemberError("");
        setMembers(firebaseMembers);
      },
      (error) => {
        console.error("Üyeler okunamadı:", error);
        setMemberError(`Üyeler okunamadı: ${error.message}`);
      }
    );

    return () => unsubscribe();
  }, [currentUser, activeServerId]);

  useEffect(() => {
    if (!currentUser || !activeServerId) {
      setVoiceParticipants([]);
      return;
    }

    const roomId = getVoiceRoomId(activeServerId);
    const participantsRef = collection(
      db,
      "voiceRooms",
      roomId,
      "participants"
    );

    const unsubscribe = onSnapshot(
      participantsRef,
      (snapshot) => {
        const firebaseVoiceParticipants = snapshot.docs.map((participantDoc) => {
          return {
            id: participantDoc.id,
            ...participantDoc.data(),
          };
        });

        firebaseVoiceParticipants.sort((a, b) => {
          const aName = a.displayName || a.email || "";
          const bName = b.displayName || b.email || "";
          return aName.localeCompare(bName);
        });

        setVoiceParticipants(firebaseVoiceParticipants);
      },
      (error) => {
        console.error("Ses katılımcıları okunamadı:", error);
        setVoiceError(`Ses katılımcıları okunamadı: ${error.message}`);
      }
    );

    return () => unsubscribe();
  }, [currentUser, activeServerId]);

  useEffect(() => {
    if (!voiceJoined || !currentUser || !activeServerId || !localStreamRef.current) {
      return;
    }

    const participantUids = new Set(
      activeVoiceParticipants.map((participant) => participant.uid)
    );

    peerConnectionsRef.current.forEach((_, uid) => {
      if (!participantUids.has(uid)) {
        closePeerConnection(uid);
      }
    });

    activeVoiceParticipants.forEach((participant) => {
      if (participant.uid === currentUser.uid) {
        return;
      }

      if (peerConnectionsRef.current.has(participant.uid)) {
        return;
      }

      const shouldCreateOffer = currentUser.uid < participant.uid;

      if (shouldCreateOffer) {
        createPeerConnection(participant.uid, true).catch((error) => {
          console.error("Ses bağlantısı oluşturulamadı:", error);
          setVoiceError("Ses bağlantısı oluşturulamadı.");
        });
      }
    });
  }, [voiceJoined, activeVoiceParticipants, currentUser, activeServerId]);

  useEffect(() => {
    if (!voiceJoined || !participantDocRef.current) {
      return;
    }

    updateDoc(participantDocRef.current, {
      displayName: username.trim() || "Guest",
      muted: voiceMutedRef.current,
      updatedAt: serverTimestamp(),
    }).catch((error) => {
      console.warn("Ses katılımcısı güncellenemedi:", error);
    });
  }, [username, voiceJoined]);

  useEffect(() => {
    voiceMutedRef.current = voiceMuted;
  }, [voiceMuted]);

  useEffect(() => {
    if (!voiceJoinedRef.current) {
      return;
    }

    if (!currentUser || !activeServerId) {
      leaveVoiceRoom();
      return;
    }

    const currentRoomId = getVoiceRoomId(activeServerId);

    if (voiceRoomIdRef.current && voiceRoomIdRef.current !== currentRoomId) {
      leaveVoiceRoom();
    }
  }, [currentUser, activeServerId]);

  useEffect(() => {
    return () => {
      leaveVoiceRoom(false);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem("zapchat-username", username);
  }, [username]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, activeChannel]);

  if (authLoading) {
    return (
      <div className="authPage">
        <div className="authCard">
          <h1>ZapChat</h1>
          <p>Yükleniyor...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="authPage">
        <form className="authCard">
          <div className="authLogo">Z</div>

          <h1>ZapChat</h1>
          <p>Devam etmek için giriş yap veya hesap oluştur.</p>

          <label>E-posta</label>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="ornek@mail.com"
          />

          <label>Şifre</label>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="En az 6 karakter"
          />

          {authError && <div className="authError">{authError}</div>}

          <div className="authActions">
            <button type="submit" onClick={login}>
              Giriş Yap
            </button>

            <button
              type="button"
              className="secondaryButton"
              onClick={createAccount}
            >
              Hesap Oluştur
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="app">
      <aside className="serverBar">
        {servers.map((server) => (
          <button
            key={server.id}
            className={
              activeServerId === server.id
                ? "serverIcon active"
                : "serverIcon"
            }
            title={server.name}
            onClick={() => {
              setActiveServerId(server.id);
              setActiveChannel("general");
            }}
          >
            {getServerInitial(server.name)}
          </button>
        ))}

        <button
          className="serverIcon createServerIcon"
          title="Sunucu ekle"
          onClick={openServerModal}
        >
          +
        </button>
      </aside>

      <aside className="channelBar">
        <div className="appTitle">
          <h1>{activeServer ? activeServer.name : "ZapChat"}</h1>
          <p>{activeServer ? "private lobby" : "sunucu seçilmedi"}</p>
        </div>

        {activeServer && activeServer.inviteCode && (
          <div className="inviteCodeBox">
            <span>Davet kodu</span>
            <strong>{activeServer.inviteCode}</strong>
          </div>
        )}

        {isActiveServerOwner && (
          <div className="serverDangerBox">
            <span>Sunucu sahibi</span>
            <button onClick={deleteActiveServer}>Sunucuyu Sil</button>
          </div>
        )}

        <div className="usernameBox">
          <label>Kullanıcı adın</label>
          <input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="İsim yaz"
          />
        </div>

        <div className="userBox">
          <span>Giriş yapan hesap</span>
          <strong>{currentUser.email}</strong>
          <button onClick={logout}>Çıkış Yap</button>
        </div>

        {activeServer ? (
          <>
            <div className="channelSectionTitle">Kanallar</div>

            <div className="channels">
              {channels.map((channel) => (
                <button
                  key={channel.id}
                  className={
                    activeChannel === channel.id
                      ? "channelButton active"
                      : "channelButton"
                  }
                  onClick={() => setActiveChannel(channel.id)}
                >
                  <span>#</span>
                  {channel.name}
                </button>
              ))}
            </div>

            <div className="channelSectionTitle">Ses</div>

            <div className={voiceJoined ? "voiceBox active" : "voiceBox"}>
              <div className="voiceChannelTitle">
                <span>🔊</span>
                <div>
                  <strong>Sesli Sohbet</strong>
                  <small>{activeVoiceParticipants.length} kişi bağlı</small>
                </div>
              </div>

              <div className="voiceActions">
                {!voiceJoined ? (
                  <button
                    className="voiceJoinButton"
                    onClick={joinVoiceRoom}
                    disabled={voiceJoining}
                  >
                    {voiceJoining ? "Katılınıyor..." : "Sese Katıl"}
                  </button>
                ) : (
                  <>
                    <button className="voiceMuteButton" onClick={toggleVoiceMute}>
                      {voiceMuted ? "Mikrofonu Aç" : "Mikrofonu Kapat"}
                    </button>

                    <button
                      className="voiceLeaveButton"
                      onClick={() => leaveVoiceRoom()}
                    >
                      Ayrıl
                    </button>
                  </>
                )}
              </div>

              <p className="voiceStatusText">{voiceStatus}</p>

              {voiceError && <div className="voiceErrorText">{voiceError}</div>}

              {voiceJoined && remoteStreams.length > 0 && (
                <div className="voiceRemoteCount">
                  {remoteStreams.length} uzak ses bağlantısı aktif.
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="sidebarHint">
            Bir sunucuya katılın ya da sunucu oluşturun.
          </div>
        )}
      </aside>

      <main className="chatArea">
        <header className="chatHeader">
          <div>
            {activeServer ? (
              <>
                <h2>
                  {activeServer.name} <span>/ #</span> {activeChannelName}
                </h2>
                <p>Arkadaşlarınla hızlı ve sade sohbet alanı.</p>
              </>
            ) : (
              <>
                <h2>ZapChat</h2>
                <p>Bir sunucuya katılın ya da sunucu oluşturun.</p>
              </>
            )}
          </div>

          <div className="statusBadge">
            {activeServer ? "Firebase Online" : "Hazır"}
          </div>
        </header>

        {activeServer ? (
          <>
            <section className="messages">
              {filteredMessages.length === 0 && (
                <div className="emptyState">
                  Bu kanalda henüz mesaj yok. İlk mesajı sen gönder.
                </div>
              )}

              {filteredMessages.map((message) => {
                const isOwnMessage = message.uid === currentUser.uid;

                return (
                  <div className="message" key={message.id}>
                    <div className="avatar">
                      {(message.user || "G").charAt(0).toUpperCase()}
                    </div>

                    <div className="messageContent">
                      <div className="messageMeta">
                        <strong>{message.user}</strong>
                        <span>{message.time}</span>

                        {isOwnMessage && (
                          <button
                            className="deleteButton"
                            onClick={() => deleteMessage(message.id)}
                          >
                            Sil
                          </button>
                        )}
                      </div>

                      <p>{message.text}</p>
                    </div>
                  </div>
                );
              })}

              <div ref={messagesEndRef} />
            </section>

            <form className="messageForm" onSubmit={sendMessage}>
              <input
                value={messageText}
                onChange={(event) => setMessageText(event.target.value)}
                placeholder={`#${activeChannelName} kanalına mesaj gönder`}
              />

              <button type="submit" disabled={isSending}>
                {isSending ? "..." : "Gönder"}
              </button>
            </form>
          </>
        ) : (
          <section className="noServerState">
            <div className="noServerIcon">+</div>
            <h2>Bir sunucuya katılın ya da sunucu oluşturun.</h2>
            <p>
              Başlamak için soldaki artı butonuna basıp yeni bir sunucu
              oluşturabilir veya davet koduyla mevcut bir sunucuya katılabilirsin.
            </p>
            <button onClick={openServerModal}>Sunucu Ekle</button>
          </section>
        )}
      </main>

      {activeServer && (
        <aside className="memberBar">
          <div className="memberHeader">
            <h3>Üyeler</h3>
            <span>{members.length}</span>
          </div>

          <div className="memberList">
            {memberError && <div className="memberEmpty">{memberError}</div>}

            {!memberError && members.length === 0 && (
              <div className="memberEmpty">Henüz üye bilgisi yok.</div>
            )}

            {members.map((member) => (
              <div className="memberItem" key={member.id}>
                <div className="memberAvatar">
                  {getUserInitial(member.displayName)}
                </div>

                <div className="memberInfo">
                  <strong>{member.displayName || "Guest"}</strong>
                  <span>
                    {member.role === "owner" ? "Sunucu sahibi" : "Üye"}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="voiceMemberPanel">
            <div className="memberHeader voiceMemberHeader">
              <h3>Seste</h3>
              <span>{activeVoiceParticipants.length}</span>
            </div>

            <div className="voiceMemberList">
              {activeVoiceParticipants.length === 0 && (
                <div className="memberEmpty">Şu an seste kimse yok.</div>
              )}

              {activeVoiceParticipants.map((participant) => (
                <div className="voiceMemberItem" key={participant.uid}>
                  <div className="memberAvatar">
                    {getUserInitial(participant.displayName)}
                  </div>

                  <div className="memberInfo">
                    <strong>{participant.displayName || "Guest"}</strong>
                    <span>{participant.muted ? "Mikrofon kapalı" : "Konuşabilir"}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      )}

      <div className="remoteAudioMount" aria-hidden="true">
        {remoteStreams.map((remoteStream) => (
          <RemoteAudio
            key={remoteStream.uid}
            stream={remoteStream.stream}
          />
        ))}
      </div>

      {serverModalOpen && (
        <div className="modalOverlay" onClick={closeServerModal}>
          <div className="serverModal" onClick={(event) => event.stopPropagation()}>
            <button className="modalCloseButton" onClick={closeServerModal}>
              ×
            </button>

            {!serverModalMode && (
              <>
                <h2>Sunucu ekle</h2>
                <p>
                  Yeni bir sunucu oluşturabilir veya davet koduyla katılabilirsin.
                </p>

                <div className="serverChoiceGrid">
                  <button
                    onClick={() => {
                      setServerModalMode("join");
                      setServerModalError("");
                    }}
                  >
                    <strong>Davet kodu ile katıl</strong>
                    <span>Arkadaşının verdiği kodla sunucuya gir.</span>
                  </button>

                  <button
                    onClick={() => {
                      setServerModalMode("create");
                      setServerModalError("");
                    }}
                  >
                    <strong>Sunucu oluştur</strong>
                    <span>Kendi sohbet alanını oluştur ve kodu paylaş.</span>
                  </button>
                </div>
              </>
            )}

            {serverModalMode === "create" && (
              <form onSubmit={createServer}>
                <button
                  type="button"
                  className="modalBackButton"
                  onClick={() => {
                    setServerModalMode(null);
                    setServerModalError("");
                  }}
                >
                  ← Geri
                </button>

                <h2>Sunucu oluştur</h2>
                <p>Sunucu oluşturulunca otomatik davet kodu üretilecek.</p>

                <label>Sunucu adı</label>
                <input
                  value={newServerName}
                  onChange={(event) => setNewServerName(event.target.value)}
                  placeholder="Örn: Bizim Grup"
                  maxLength={32}
                />

                {serverModalError && (
                  <div className="modalError">{serverModalError}</div>
                )}

                <button className="modalPrimaryButton" disabled={serverActionLoading}>
                  {serverActionLoading ? "Oluşturuluyor..." : "Sunucu Oluştur"}
                </button>
              </form>
            )}

            {serverModalMode === "join" && (
              <form onSubmit={joinServer}>
                <button
                  type="button"
                  className="modalBackButton"
                  onClick={() => {
                    setServerModalMode(null);
                    setServerModalError("");
                  }}
                >
                  ← Geri
                </button>

                <h2>Davet kodu ile katıl</h2>
                <p>Arkadaşının verdiği davet kodunu yaz.</p>

                <label>Davet kodu</label>
                <input
                  value={joinInviteCode}
                  onChange={(event) => setJoinInviteCode(event.target.value)}
                  placeholder="Örn: AB12-CD34"
                />

                {serverModalError && (
                  <div className="modalError">{serverModalError}</div>
                )}

                <button className="modalPrimaryButton" disabled={serverActionLoading}>
                  {serverActionLoading ? "Katılınıyor..." : "Sunucuya Katıl"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;