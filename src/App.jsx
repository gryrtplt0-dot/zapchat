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
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { auth, db } from "./firebase";
import "./App.css";

const defaultServer = {
  id: "main",
  name: "ZapChat",
  inviteCode: null,
  isDefault: true,
  role: "member",
};

function App() {
  const [username, setUsername] = useState(() => {
    return localStorage.getItem("zapchat-username") || "Guest";
  });

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [servers, setServers] = useState([defaultServer]);
  const [activeServerId, setActiveServerId] = useState("main");

  const [activeChannel, setActiveChannel] = useState("general");
  const [messageText, setMessageText] = useState("");
  const [messages, setMessages] = useState([]);

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

  const messagesEndRef = useRef(null);

  const channels = [
    { id: "general", name: "genel" },
    { id: "gaming", name: "oyun" },
    { id: "study", name: "ders" },
    { id: "random", name: "rastgele" },
  ];

  const activeServer =
    servers.find((server) => server.id === activeServerId) || defaultServer;

  const isActiveServerOwner =
    activeServer.id !== "main" && activeServer.role === "owner";

  const filteredMessages = messages.filter(
    (message) => message.channel === activeChannel
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

  function openServerModal() {
    setServerModalOpen(true);
    setServerModalMode(null);
    setNewServerName("");
    setJoinInviteCode("");
    setServerModalError("");
  }

  function closeServerModal() {
    if (serverActionLoading) {
      return;
    }

    setServerModalOpen(false);
    setServerModalMode(null);
    setNewServerName("");
    setJoinInviteCode("");
    setServerModalError("");
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

      await setDoc(doc(db, "userServers", currentUser.uid, "servers", serverRef.id), {
        serverId: serverRef.id,
        serverName: cleanName,
        uid: currentUser.uid,
        email: currentUser.email,
        role: "owner",
        inviteCode,
        joinedAt: serverTimestamp(),
      });

      setActiveServerId(serverRef.id);
      setActiveChannel("general");
      closeServerModal();

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
      closeServerModal();
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
    if (!currentUser || activeServer.id === "main") {
      return;
    }

    if (activeServer.role !== "owner") {
      alert("Bu sunucuyu sadece sunucu sahibi silebilir.");
      return;
    }

    const shouldDelete = confirm(
      `"${activeServer.name}" sunucusu silinsin mi?\n\nBu işlem sunucuyu herkesten gizler ve davet kodunu devre dışı bırakır.`
    );

    if (!shouldDelete) {
      return;
    }

    try {
      await updateDoc(doc(db, "servers", activeServer.id), {
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

      setActiveServerId("main");
      setActiveChannel("general");
    } catch (error) {
      console.error("Sunucu silinemedi:", error);
      alert("Sunucu silinemedi. Sadece sunucu sahibi silebilir.");
    }
  }

  async function sendMessage(event) {
    event.preventDefault();

    const cleanText = messageText.trim();
    const cleanUsername = username.trim() || "Guest";

    if (cleanText === "" || !currentUser) {
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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!currentUser) {
      setServers([defaultServer]);
      setActiveServerId("main");
      return;
    }

    const membershipsRef = collection(
      db,
      "userServers",
      currentUser.uid,
      "servers"
    );

    const unsubscribe = onSnapshot(
      membershipsRef,
      async (snapshot) => {
        const joinedServers = await Promise.all(
          snapshot.docs.map(async (membershipDoc) => {
            const membershipData = membershipDoc.data();
            const serverId = membershipData.serverId || membershipDoc.id;
            const serverRef = doc(db, "servers", serverId);
            const serverSnap = await getDoc(serverRef);

            if (!serverSnap.exists()) {
              return null;
            }

            const serverData = serverSnap.data();

            if (serverData.deleted === true) {
              return null;
            }

            return {
              id: serverSnap.id,
              role: membershipData.role || "member",
              ...serverData,
            };
          })
        );

        const cleanServers = joinedServers.filter(Boolean);

        cleanServers.sort((a, b) => {
          const aTime = a.createdAt?.toMillis?.() || 0;
          const bTime = b.createdAt?.toMillis?.() || 0;
          return aTime - bTime;
        });

        setServers([defaultServer, ...cleanServers]);
      },
      (error) => {
        console.error("Sunucular okunamadı:", error);
      }
    );

    return () => unsubscribe();
  }, [currentUser]);

  useEffect(() => {
    const stillExists = servers.some((server) => server.id === activeServerId);

    if (!stillExists) {
      setActiveServerId("main");
      setActiveChannel("general");
    }
  }, [servers, activeServerId]);

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
          <h1>{activeServer.name}</h1>
          <p>private lobby</p>
        </div>

        {activeServer.id !== "main" && activeServer.inviteCode && (
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
      </aside>

      <main className="chatArea">
        <header className="chatHeader">
          <div>
            <h2>
              {activeServer.name} <span>/ #</span>{" "}
              {channels.find((c) => c.id === activeChannel).name}
            </h2>
            <p>Arkadaşlarınla hızlı ve sade sohbet alanı.</p>
          </div>

          <div className="statusBadge">Firebase Online</div>
        </header>

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
            placeholder={`#${
              channels.find((c) => c.id === activeChannel).name
            } kanalına mesaj gönder`}
          />

          <button type="submit" disabled={isSending}>
            {isSending ? "..." : "Gönder"}
          </button>
        </form>
      </main>

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
                  <button onClick={() => setServerModalMode("join")}>
                    <strong>Davet kodu ile katıl</strong>
                    <span>Arkadaşının verdiği kodla sunucuya gir.</span>
                  </button>

                  <button onClick={() => setServerModalMode("create")}>
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