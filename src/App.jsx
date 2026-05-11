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
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "./firebase";
import "./App.css";

function App() {
  const [username, setUsername] = useState(() => {
    return localStorage.getItem("zapchat-username") || "Guest";
  });

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [activeChannel, setActiveChannel] = useState("general");
  const [messageText, setMessageText] = useState("");
  const [messages, setMessages] = useState([]);

  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState("");
  const [isSending, setIsSending] = useState(false);

  const messagesEndRef = useRef(null);

  const channels = [
    { id: "general", name: "genel" },
    { id: "gaming", name: "oyun" },
    { id: "study", name: "ders" },
    { id: "random", name: "rastgele" },
  ];

  const filteredMessages = messages.filter(
    (message) => message.channel === activeChannel
  );

  function getCurrentTime() {
    const now = new Date();
    const hour = String(now.getHours()).padStart(2, "0");
    const minute = String(now.getMinutes()).padStart(2, "0");
    return `${hour}:${minute}`;
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
      setMessages([]);
      return;
    }

    const messagesCollection = collection(db, "messages");
    const messagesQuery = query(messagesCollection, orderBy("createdAt", "asc"));

    const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
      const firebaseMessages = snapshot.docs.map((document) => {
        return {
          id: document.id,
          ...document.data(),
        };
      });

      setMessages(firebaseMessages);
    });

    return () => unsubscribe();
  }, [currentUser]);

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

            <button type="button" className="secondaryButton" onClick={createAccount}>
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
        <div className="serverIcon active">Z</div>
        <div className="serverIcon">+</div>
      </aside>

      <aside className="channelBar">
        <div className="appTitle">
          <h1>ZapChat</h1>
          <p>private lobby</p>
        </div>

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
              <span>#</span> {channels.find((c) => c.id === activeChannel).name}
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
    </div>
  );
}

export default App;