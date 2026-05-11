import { useEffect, useRef, useState } from "react";
import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import "./App.css";

function App() {
  const [username, setUsername] = useState(() => {
    return localStorage.getItem("zapchat-username") || "Guest";
  });

  const [activeChannel, setActiveChannel] = useState("general");
  const [messageText, setMessageText] = useState("");
  const [messages, setMessages] = useState([]);
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

  async function sendMessage(event) {
    event.preventDefault();

    const cleanText = messageText.trim();
    const cleanUsername = username.trim() || "Guest";

    if (cleanText === "") {
      return;
    }

    try {
      setIsSending(true);

      await addDoc(collection(db, "messages"), {
        channel: activeChannel,
        user: cleanUsername,
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

  useEffect(() => {
    const messagesCollection = collection(db, "messages");
    const messagesQuery = query(messagesCollection, orderBy("createdAt", "asc"));

    const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
      const firebaseMessages = snapshot.docs.map((doc) => {
        return {
          id: doc.id,
          ...doc.data(),
        };
      });

      setMessages(firebaseMessages);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    localStorage.setItem("zapchat-username", username);
  }, [username]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, activeChannel]);

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

          {filteredMessages.map((message) => (
            <div className="message" key={message.id}>
              <div className="avatar">
                {(message.user || "G").charAt(0).toUpperCase()}
              </div>

              <div className="messageContent">
                <div className="messageMeta">
                  <strong>{message.user}</strong>
                  <span>{message.time}</span>
                </div>

                <p>{message.text}</p>
              </div>
            </div>
          ))}

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