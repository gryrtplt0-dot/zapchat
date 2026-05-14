/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
import { useEffect, useMemo, useRef, useState } from "react";
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
import {
  getDownloadURL,
  ref as storageReference,
  uploadBytesResumable,
} from "firebase/storage";
import { auth, db, storage } from "./firebase";
import "./App.css";

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

const PRESENCE_HEARTBEAT_MS = 25000;
const ONLINE_TIMEOUT_MS = 70000;
const MAX_UPLOAD_SIZE_BYTES = 500 * 1024 * 1024;
const MAX_UPLOAD_SIZE_LABEL = "500 MB";
const GIF_PROVIDER = (import.meta.env.VITE_GIF_PROVIDER || "giphy").toLowerCase();
const GIPHY_API_KEY = import.meta.env.VITE_GIPHY_API_KEY || "";
const TENOR_API_KEY = import.meta.env.VITE_TENOR_API_KEY || "";
const GIF_RESULT_LIMIT = 24;
const GIF_SEARCH_DEBOUNCE_MS = 450;
const GIF_CLIENT_KEY = "zapchat";
const EMOJI_CATEGORIES = [
  {
    id: "smileys",
    label: "İnsanlar",
    icon: "😀",
    keywords: ["smile", "face", "insan", "yüz", "mutlu", "duygu"],
    emojis: [
      "😀", "😃", "😄", "😁", "😆", "😅", "🤣", "😂", "🙂", "🙃", "🫠", "😉",
      "😊", "😇", "🥰", "😍", "🤩", "😘", "😗", "☺️", "😚", "😙", "🥲", "😋",
      "😛", "😜", "🤪", "😝", "🤑", "🤗", "🤭", "🫢", "🫣", "🤫", "🤔", "🫡",
      "🤐", "🤨", "😐", "😑", "😶", "🫥", "😶‍🌫️", "😏", "😒", "🙄", "😬", "😮‍💨",
      "🤥", "😌", "😔", "😪", "🤤", "😴", "😷", "🤒", "🤕", "🤢", "🤮", "🤧",
      "🥵", "🥶", "🥴", "😵", "😵‍💫", "🤯", "🤠", "🥳", "🥸", "😎", "🤓", "🧐",
      "😕", "🫤", "😟", "🙁", "☹️", "😮", "😯", "😲", "😳", "🥺", "🥹", "😦",
      "😧", "😨", "😰", "😥", "😢", "😭", "😱", "😖", "😣", "😞", "😓", "😩",
      "😫", "🥱", "😤", "😡", "😠", "🤬", "😈", "👿", "💀", "☠️", "💩", "🤡",
      "👹", "👺", "👻", "👽", "👾", "🤖", "😺", "😸", "😹", "😻", "😼", "😽",
      "🙀", "😿", "😾", "🙈", "🙉", "🙊"
    ],
  },
  {
    id: "people",
    label: "Kişiler",
    icon: "👋",
    keywords: ["people", "hand", "person", "kişi", "el", "vücut"],
    emojis: [
      "👋", "🤚", "🖐️", "✋", "🖖", "🫱", "🫲", "🫳", "🫴", "👌", "🤌", "🤏",
      "✌️", "🤞", "🫰", "🤟", "🤘", "🤙", "👈", "👉", "👆", "🖕", "👇", "☝️",
      "🫵", "👍", "👎", "✊", "👊", "🤛", "🤜", "👏", "🙌", "🫶", "👐", "🤲",
      "🤝", "🙏", "✍️", "💅", "🤳", "💪", "🦾", "🦿", "🦵", "🦶", "👂", "🦻",
      "👃", "🧠", "🫀", "🫁", "🦷", "🦴", "👀", "👁️", "👅", "👄", "🫦", "👶",
      "🧒", "👦", "👧", "🧑", "👱", "👨", "🧔", "👩", "🧓", "👴", "👵", "🙍",
      "🙎", "🙅", "🙆", "💁", "🙋", "🧏", "🙇", "🤦", "🤷", "👮", "🕵️", "💂",
      "🥷", "👷", "🫅", "🤴", "👸", "👳", "👲", "🧕", "🤵", "👰", "🤰", "🫃",
      "🫄", "🤱", "👼", "🎅", "🤶", "🦸", "🦹", "🧙", "🧚", "🧛", "🧜", "🧝",
      "🧞", "🧟", "🧌", "💆", "💇", "🚶", "🧍", "🧎", "🏃", "💃", "🕺", "🕴️",
      "👯", "🧖", "🧗", "🧘", "🛀", "🛌"
    ],
  },
  {
    id: "animals",
    label: "Doğa",
    icon: "🐻",
    keywords: ["animal", "nature", "hayvan", "doğa", "bitki"],
    emojis: [
      "🐵", "🐒", "🦍", "🦧", "🐶", "🐕", "🦮", "🐕‍🦺", "🐩", "🐺", "🦊", "🦝",
      "🐱", "🐈", "🐈‍⬛", "🦁", "🐯", "🐅", "🐆", "🐴", "🫎", "🫏", "🐎", "🦄",
      "🦓", "🦌", "🦬", "🐮", "🐂", "🐃", "🐄", "🐷", "🐖", "🐗", "🐽", "🐏",
      "🐑", "🐐", "🐪", "🐫", "🦙", "🦒", "🐘", "🦣", "🦏", "🦛", "🐭", "🐁",
      "🐀", "🐹", "🐰", "🐇", "🐿️", "🦫", "🦔", "🦇", "🐻", "🐻‍❄️", "🐨", "🐼",
      "🦥", "🦦", "🦨", "🦘", "🦡", "🐾", "🦃", "🐔", "🐓", "🐣", "🐤", "🐥",
      "🐦", "🐧", "🕊️", "🦅", "🦆", "🦢", "🦉", "🦤", "🪶", "🦩", "🦚", "🦜",
      "🪽", "🐦‍⬛", "🪿", "🐸", "🐊", "🐢", "🦎", "🐍", "🐲", "🐉", "🦕", "🦖",
      "🐳", "🐋", "🐬", "🦭", "🐟", "🐠", "🐡", "🦈", "🐙", "🐚", "🪸", "🪼",
      "🐌", "🦋", "🐛", "🐜", "🐝", "🪲", "🐞", "🦗", "🪳", "🕷️", "🕸️", "🦂",
      "🦟", "🪰", "🪱", "🦠", "💐", "🌸", "💮", "🪷", "🏵️", "🌹", "🥀", "🌺",
      "🌻", "🌼", "🌷", "🪻", "🌱", "🪴", "🌲", "🌳", "🌴", "🌵", "🌾", "🌿",
      "☘️", "🍀", "🍁", "🍂", "🍃", "🪹", "🪺", "🍄", "🌰", "🦀", "🦞", "🦐"
    ],
  },
  {
    id: "food",
    label: "Yiyecek",
    icon: "🍔",
    keywords: ["food", "drink", "yemek", "içecek", "meyve"],
    emojis: [
      "🍇", "🍈", "🍉", "🍊", "🍋", "🍌", "🍍", "🥭", "🍎", "🍏", "🍐", "🍑",
      "🍒", "🍓", "🫐", "🥝", "🍅", "🫒", "🥥", "🥑", "🍆", "🥔", "🥕", "🌽",
      "🌶️", "🫑", "🥒", "🥬", "🥦", "🧄", "🧅", "🥜", "🫘", "🌰", "🫚", "🫛",
      "🍞", "🥐", "🥖", "🫓", "🥨", "🥯", "🥞", "🧇", "🧀", "🍖", "🍗", "🥩",
      "🥓", "🍔", "🍟", "🍕", "🌭", "🥪", "🌮", "🌯", "🫔", "🥙", "🧆", "🥚",
      "🍳", "🥘", "🍲", "🫕", "🥣", "🥗", "🍿", "🧈", "🧂", "🥫", "🍱", "🍘",
      "🍙", "🍚", "🍛", "🍜", "🍝", "🍠", "🍢", "🍣", "🍤", "🍥", "🥮", "🍡",
      "🥟", "🥠", "🥡", "🦪", "🍦", "🍧", "🍨", "🍩", "🍪", "🎂", "🍰", "🧁",
      "🥧", "🍫", "🍬", "🍭", "🍮", "🍯", "🍼", "🥛", "☕", "🫖", "🍵", "🍶",
      "🍾", "🍷", "🍸", "🍹", "🍺", "🍻", "🥂", "🥃", "🫗", "🥤", "🧋", "🧃",
      "🧉", "🧊", "🥢", "🍽️", "🍴", "🥄", "🔪", "🫙", "🏺"
    ],
  },
  {
    id: "activity",
    label: "Aktivite",
    icon: "⚽",
    keywords: ["activity", "sport", "game", "aktivite", "oyun", "spor"],
    emojis: [
      "⚽", "🏀", "🏈", "⚾", "🥎", "🎾", "🏐", "🏉", "🥏", "🎱", "🪀", "🏓",
      "🏸", "🏒", "🏑", "🥍", "🏏", "🪃", "🥅", "⛳", "🪁", "🏹", "🎣", "🤿",
      "🥊", "🥋", "🎽", "🛹", "🛼", "🛷", "⛸️", "🥌", "🎿", "⛷️", "🏂", "🪂",
      "🏋️", "🤼", "🤸", "⛹️", "🤺", "🤾", "🏌️", "🏇", "🧘", "🏄", "🏊", "🤽",
      "🚣", "🧗", "🚵", "🚴", "🏆", "🥇", "🥈", "🥉", "🏅", "🎖️", "🏵️", "🎗️",
      "🎫", "🎟️", "🎪", "🤹", "🎭", "🩰", "🎨", "🎬", "🎤", "🎧", "🎼", "🎹",
      "🥁", "🪘", "🎷", "🎺", "🪗", "🎸", "🪕", "🎻", "🪈", "🎲", "♟️", "🎯",
      "🎳", "🎮", "🎰", "🧩", "🧸", "🪅", "🪩", "🪆", "♥️", "♦️", "♣️", "♠️",
      "🃏", "🀄", "🎴", "🎁", "🎈", "🎏", "🎀", "🧧", "🎊", "🎉"
    ],
  },
  {
    id: "travel",
    label: "Seyahat",
    icon: "🚗",
    keywords: ["travel", "place", "vehicle", "seyahat", "yer", "araç"],
    emojis: [
      "🌍", "🌎", "🌏", "🌐", "🗺️", "🗾", "🧭", "🏔️", "⛰️", "🌋", "🗻", "🏕️",
      "🏖️", "🏜️", "🏝️", "🏞️", "🏟️", "🏛️", "🏗️", "🧱", "🪨", "🪵", "🛖", "🏘️",
      "🏚️", "🏠", "🏡", "🏢", "🏣", "🏤", "🏥", "🏦", "🏨", "🏩", "🏪", "🏫",
      "🏬", "🏭", "🏯", "🏰", "💒", "🗼", "🗽", "⛪", "🕌", "🛕", "🕍", "⛩️",
      "🕋", "⛲", "⛺", "🌁", "🌃", "🏙️", "🌄", "🌅", "🌆", "🌇", "🌉", "♨️",
      "🎠", "🛝", "🎡", "🎢", "💈", "🎪", "🚂", "🚃", "🚄", "🚅", "🚆", "🚇",
      "🚈", "🚉", "🚊", "🚝", "🚞", "🚋", "🚌", "🚍", "🚎", "🚐", "🚑", "🚒",
      "🚓", "🚔", "🚕", "🚖", "🚗", "🚘", "🚙", "🛻", "🚚", "🚛", "🚜", "🏎️",
      "🏍️", "🛵", "🦽", "🦼", "🛺", "🚲", "🛴", "🛹", "🛼", "🚏", "🛣️", "🛤️",
      "🛢️", "⛽", "🛞", "🚨", "🚥", "🚦", "🛑", "🚧", "⚓", "🛟", "⛵", "🛶",
      "🚤", "🛳️", "⛴️", "🛥️", "🚢", "✈️", "🛩️", "🛫", "🛬", "🪂", "💺", "🚁",
      "🚟", "🚠", "🚡", "🛰️", "🚀", "🛸", "🛎️", "🧳", "⌛", "⏳", "⌚", "⏰"
    ],
  },
  {
    id: "objects",
    label: "Nesneler",
    icon: "💡",
    keywords: ["object", "tool", "nesne", "araç", "ofis", "teknoloji"],
    emojis: [
      "💌", "💣", "🛀", "🛌", "🔪", "🏺", "🗺️", "🧭", "🧱", "💈", "🛢️", "🛎️",
      "🧳", "⌛", "⏳", "⌚", "⏰", "⏱️", "⏲️", "🕰️", "🌡️", "⛱️", "🧨", "🎈",
      "🎉", "🎊", "🎎", "🎏", "🎐", "🧧", "🎀", "🎁", "🤿", "🪀", "🪁", "🔮",
      "🪄", "🧿", "🪬", "🎮", "🕹️", "🎰", "🎲", "🧩", "🧸", "🪅", "🪩", "🪆",
      "🖼️", "🎨", "🧵", "🪡", "🧶", "🪢", "👓", "🕶️", "🥽", "🥼", "🦺", "👔",
      "👕", "👖", "🧣", "🧤", "🧥", "🧦", "👗", "🥻", "🩱", "🩲", "🩳", "👙",
      "👚", "🪭", "👛", "👜", "👝", "🛍️", "🎒", "🩴", "👞", "👟", "🥾", "🥿",
      "👠", "👡", "🩰", "👢", "🪮", "👑", "👒", "🎩", "🎓", "🧢", "🪖", "⛑️",
      "📿", "💄", "💍", "💎", "🔇", "🔈", "🔉", "🔊", "📢", "📣", "📯", "🔔",
      "🔕", "🎼", "🎵", "🎶", "🎙️", "🎚️", "🎛️", "🎤", "🎧", "📻", "🎷", "🪗",
      "🎸", "🎹", "🎺", "🎻", "🪕", "🥁", "🪘", "🪈", "📱", "📲", "☎️", "📞",
      "📟", "📠", "🔋", "🪫", "🔌", "💻", "🖥️", "🖨️", "⌨️", "🖱️", "🖲️", "💽",
      "💾", "💿", "📀", "🧮", "🎥", "🎞️", "📽️", "🎬", "📺", "📷", "📸", "📹",
      "📼", "🔍", "🔎", "🕯️", "💡", "🔦", "🏮", "🪔", "📔", "📕", "📖", "📗",
      "📘", "📙", "📚", "📓", "📒", "📃", "📜", "📄", "📰", "🗞️", "📑", "🔖",
      "🏷️", "💰", "🪙", "💴", "💵", "💶", "💷", "💸", "💳", "🧾", "💹", "✉️",
      "📧", "📨", "📩", "📤", "📥", "📦", "📫", "📪", "📬", "📭", "📮", "🗳️",
      "✏️", "✒️", "🖋️", "🖊️", "🖌️", "🖍️", "📝", "💼", "📁", "📂", "🗂️", "📅",
      "📆", "🗒️", "🗓️", "📇", "📈", "📉", "📊", "📋", "📌", "📍", "📎", "🖇️",
      "📏", "📐", "✂️", "🗃️", "🗄️", "🗑️", "🔒", "🔓", "🔏", "🔐", "🔑", "🗝️"
    ],
  },
  {
    id: "symbols",
    label: "Semboller",
    icon: "❤️",
    keywords: ["symbol", "heart", "sembol", "kalp", "işaret"],
    emojis: [
      "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🩶", "🤍", "🤎", "💔", "❤️‍🔥",
      "❤️‍🩹", "❣️", "💕", "💞", "💓", "💗", "💖", "💘", "💝", "💟", "☮️", "✝️",
      "☪️", "🕉️", "☸️", "✡️", "🔯", "🕎", "☯️", "☦️", "🛐", "⛎", "♈", "♉",
      "♊", "♋", "♌", "♍", "♎", "♏", "♐", "♑", "♒", "♓", "🆔", "⚛️",
      "🉑", "☢️", "☣️", "📴", "📳", "🈶", "🈚", "🈸", "🈺", "🈷️", "✴️", "🆚",
      "💮", "🉐", "㊙️", "㊗️", "🈴", "🈵", "🈹", "🈲", "🅰️", "🅱️", "🆎", "🆑",
      "🅾️", "🆘", "❌", "⭕", "🛑", "⛔", "📛", "🚫", "💯", "💢", "♨️", "🚷",
      "🚯", "🚳", "🚱", "🔞", "📵", "🚭", "❗", "❕", "❓", "❔", "‼️", "⁉️",
      "🔅", "🔆", "〽️", "⚠️", "🚸", "🔱", "⚜️", "🔰", "♻️", "✅", "🈯", "💹",
      "❇️", "✳️", "❎", "🌐", "💠", "Ⓜ️", "🌀", "💤", "🏧", "🚾", "♿", "🅿️",
      "🛗", "🈳", "🈂️", "🛂", "🛃", "🛄", "🛅", "🚹", "🚺", "🚼", "⚧️", "🚻",
      "🚮", "🎦", "📶", "🈁", "🔣", "ℹ️", "🔤", "🔡", "🔠", "🆖", "🆗", "🆙",
      "🆒", "🆕", "🆓", "0️⃣", "1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣",
      "9️⃣", "🔟", "🔢", "#️⃣", "*️⃣", "⏏️", "▶️", "⏸️", "⏯️", "⏹️", "⏺️", "⏭️",
      "⏮️", "⏩", "⏪", "⏫", "⏬", "◀️", "🔼", "🔽", "➡️", "⬅️", "⬆️", "⬇️",
      "↗️", "↘️", "↙️", "↖️", "↕️", "↔️", "↪️", "↩️", "⤴️", "⤵️", "🔀", "🔁",
      "🔂", "🔄", "🔃", "🎵", "🎶", "➕", "➖", "➗", "✖️", "🟰", "♾️", "💲",
      "💱", "™️", "©️", "®️", "〰️", "➰", "➿", "🔚", "🔙", "🔛", "🔝", "🔜",
      "✔️", "☑️", "🔘", "🔴", "🟠", "🟡", "🟢", "🔵", "🟣", "⚫", "⚪", "🟤",
      "🔺", "🔻", "🔸", "🔹", "🔶", "🔷", "🔳", "🔲", "▪️", "▫️", "◾", "◽",
      "◼️", "◻️", "🟥", "🟧", "🟨", "🟩", "🟦", "🟪", "⬛", "⬜", "🟫"
    ],
  },
  {
    id: "flags",
    label: "Bayraklar",
    icon: "🏳️",
    keywords: ["flag", "bayrak", "ülke"],
    emojis: [
      "🏁", "🚩", "🎌", "🏴", "🏳️", "🏳️‍🌈", "🏳️‍⚧️", "🏴‍☠️", "🇹🇷", "🇺🇸", "🇬🇧", "🇩🇪",
      "🇫🇷", "🇮🇹", "🇪🇸", "🇵🇹", "🇳🇱", "🇧🇪", "🇨🇭", "🇦🇹", "🇩🇰", "🇸🇪", "🇳🇴", "🇫🇮",
      "🇮🇸", "🇮🇪", "🇵🇱", "🇨🇿", "🇸🇰", "🇭🇺", "🇷🇴", "🇧🇬", "🇬🇷", "🇺🇦", "🇷🇺", "🇯🇵",
      "🇰🇷", "🇨🇳", "🇮🇳", "🇵🇰", "🇧🇩", "🇮🇩", "🇲🇾", "🇸🇬", "🇹🇭", "🇵🇭", "🇻🇳", "🇦🇺",
      "🇳🇿", "🇨🇦", "🇲🇽", "🇧🇷", "🇦🇷", "🇨🇱", "🇨🇴", "🇵🇪", "🇿🇦", "🇪🇬", "🇲🇦", "🇳🇬",
      "🇸🇦", "🇦🇪", "🇶🇦", "🇮🇱", "🇮🇷", "🇮🇶", "🇦🇿", "🇬🇪", "🇦🇲", "🇰🇿", "🇺🇿", "🇰🇬"
    ],
  },
];


const EMOJIBASE_DATA_URL = "https://cdn.jsdelivr.net/npm/emojibase-data@15.3.2/en/compact.json";

const EMOJI_GROUP_CONFIG = [
  { id: "smileys", label: "İnsanlar", icon: "😀", groups: [0], keywords: ["smile", "smiley", "face", "emotion", "happy", "insan", "yüz"] },
  { id: "people", label: "Kişiler", icon: "👋", groups: [1], keywords: ["people", "person", "body", "hand", "gesture", "kişi", "el"] },
  { id: "animals", label: "Doğa", icon: "🐻", groups: [2], keywords: ["animal", "nature", "plant", "hayvan", "doğa"] },
  { id: "food", label: "Yiyecek", icon: "🍔", groups: [3], keywords: ["food", "drink", "fruit", "yemek", "içecek"] },
  { id: "travel", label: "Seyahat", icon: "🚗", groups: [4], keywords: ["travel", "place", "vehicle", "car", "seyahat", "araç"] },
  { id: "activity", label: "Aktivite", icon: "⚽", groups: [5], keywords: ["activity", "sport", "game", "aktivite", "spor", "oyun"] },
  { id: "objects", label: "Nesneler", icon: "💡", groups: [6], keywords: ["object", "tool", "technology", "office", "nesne", "araç"] },
  { id: "symbols", label: "Semboller", icon: "❤️", groups: [7], keywords: ["symbol", "heart", "sign", "sembol", "kalp"] },
  { id: "flags", label: "Bayraklar", icon: "🏳️", groups: [8], keywords: ["flag", "country", "bayrak", "ülke"] },
];

const FALLBACK_EMOJI_NAMES = {
  "😀": "grinning face smile happy",
  "😃": "smiley smiling face happy",
  "😄": "smile smiling face happy",
  "😁": "beaming face grin smile happy",
  "😆": "laughing squinting face xd happy",
  "😅": "sweat smile nervous laugh",
  "🤣": "rolling on the floor laughing rofl lmao",
  "😂": "joy face with tears laughing lol",
  "🙂": "slightly smiling face smile",
  "🙃": "upside down face silly",
  "😉": "wink winking face",
  "😊": "blush smiling face happy",
  "😇": "innocent angel halo",
  "🥰": "smiling face with hearts love",
  "😍": "heart eyes love crush",
  "🤩": "star struck excited wow",
  "😘": "kissing face heart love",
  "😋": "yum tasty delicious",
  "😛": "tongue face playful",
  "😜": "wink tongue silly",
  "🤪": "zany crazy silly",
  "🤑": "money mouth rich",
  "🤗": "hug hugging face",
  "🤭": "hand over mouth giggle",
  "🤫": "shushing face quiet",
  "🤔": "thinking face hmm",
  "🤐": "zipper mouth secret",
  "😐": "neutral face",
  "😑": "expressionless face",
  "😏": "smirk smirking face",
  "😒": "unamused annoyed",
  "🙄": "rolling eyes",
  "😬": "grimacing face awkward",
  "😌": "relieved face calm",
  "😔": "pensive sad",
  "😪": "sleepy tired",
  "🤤": "drooling face",
  "😴": "sleeping face sleep",
  "😷": "medical mask sick",
  "🤒": "thermometer sick fever",
  "🤕": "head bandage hurt",
  "🤢": "nauseated sick green",
  "🤮": "vomiting puke sick",
  "🤧": "sneezing face sick",
  "🥵": "hot face heat",
  "🥶": "cold face freezing",
  "🥴": "woozy face drunk",
  "😵": "dizzy face dead",
  "🤯": "exploding head mind blown",
  "🤠": "cowboy hat face",
  "🥳": "partying face party birthday",
  "😎": "sunglasses cool",
  "🤓": "nerd face glasses",
  "😕": "confused face",
  "😟": "worried face",
  "🙁": "slightly frowning face sad",
  "☹️": "frowning face sad",
  "😮": "open mouth surprised",
  "😲": "astonished shocked",
  "😳": "flushed embarrassed",
  "🥺": "pleading face puppy eyes",
  "😢": "cry crying sad tear",
  "😭": "sob loudly crying sad",
  "😱": "scream fear scared",
  "😖": "confounded frustrated",
  "😣": "persevering face",
  "😞": "disappointed sad",
  "😓": "downcast sweat sad",
  "😩": "weary tired",
  "😫": "tired face exhausted",
  "🥱": "yawning face bored tired",
  "😤": "triumph steam nose angry",
  "😡": "rage angry red face",
  "😠": "angry face mad",
  "🤬": "cursing face swearing",
  "😈": "smiling devil horns",
  "👿": "angry devil demon",
  "💀": "skull dead",
  "☠️": "skull and crossbones danger",
  "💩": "poop pile of poo",
  "🤡": "clown face",
  "👻": "ghost spooky",
  "👽": "alien ufo",
  "🤖": "robot",
  "👋": "wave waving hand hello hi",
  "🤚": "raised back of hand",
  "🖐️": "hand fingers splayed",
  "✋": "raised hand high five stop",
  "👌": "ok hand perfect",
  "✌️": "victory hand peace",
  "🤞": "crossed fingers luck",
  "🤟": "love you gesture",
  "🤘": "rock on horns",
  "🤙": "call me hand",
  "👈": "backhand index pointing left",
  "👉": "backhand index pointing right",
  "👆": "pointing up",
  "👇": "pointing down",
  "☝️": "index pointing up",
  "👍": "thumbs up like approve yes",
  "👎": "thumbs down dislike no",
  "✊": "raised fist power",
  "👊": "fist bump punch",
  "👏": "clapping hands applause clap",
  "🙌": "raising hands celebrate",
  "🙏": "folded hands pray thanks please",
  "💪": "flexed biceps muscle strong",
  "👀": "eyes looking",
  "👁️": "eye",
  "👅": "tongue",
  "👄": "mouth lips",
  "🧠": "brain smart",
  "👶": "baby",
  "👦": "boy",
  "👧": "girl",
  "🧑": "person",
  "👨": "man",
  "👩": "woman",
  "👴": "old man",
  "👵": "old woman",
  "👮": "police officer",
  "🥷": "ninja",
  "👷": "construction worker",
  "🤴": "prince king",
  "👸": "princess queen",
  "🎅": "santa claus christmas",
  "🦸": "superhero",
  "🦹": "supervillain",
  "🧙": "mage wizard witch",
  "🧟": "zombie",
  "🚶": "walking person",
  "🏃": "running person run",
  "💃": "woman dancing dance",
  "🕺": "man dancing dance",
  "🐶": "dog face puppy",
  "🐱": "cat face kitten",
  "🐭": "mouse face",
  "🐹": "hamster face",
  "🐰": "rabbit bunny face",
  "🦊": "fox face",
  "🐻": "bear face",
  "🐼": "panda face",
  "🐨": "koala",
  "🐯": "tiger face",
  "🦁": "lion face",
  "🐮": "cow face",
  "🐷": "pig face",
  "🐸": "frog face",
  "🐵": "monkey face",
  "🐔": "chicken",
  "🐧": "penguin",
  "🐦": "bird",
  "🦆": "duck",
  "🦉": "owl",
  "🐺": "wolf",
  "🐴": "horse face",
  "🦄": "unicorn",
  "🐝": "honeybee bee",
  "🦋": "butterfly",
  "🐌": "snail",
  "🐞": "lady beetle ladybug",
  "🐜": "ant",
  "🕷️": "spider",
  "🐢": "turtle",
  "🐍": "snake",
  "🐳": "whale",
  "🐬": "dolphin",
  "🐟": "fish",
  "🐙": "octopus",
  "🦀": "crab",
  "🌹": "rose flower",
  "🌻": "sunflower",
  "🌼": "blossom flower",
  "🌷": "tulip flower",
  "🌲": "evergreen tree",
  "🌳": "deciduous tree",
  "🌴": "palm tree",
  "🌵": "cactus",
  "🍀": "four leaf clover luck",
  "🍁": "maple leaf autumn",
  "🍄": "mushroom",
  "🍎": "red apple fruit",
  "🍏": "green apple fruit",
  "🍌": "banana fruit",
  "🍉": "watermelon fruit",
  "🍇": "grapes fruit",
  "🍓": "strawberry fruit",
  "🍒": "cherries fruit",
  "🍑": "peach fruit",
  "🍍": "pineapple fruit",
  "🥥": "coconut fruit",
  "🥑": "avocado",
  "🍅": "tomato",
  "🥕": "carrot vegetable",
  "🌽": "corn vegetable",
  "🌶️": "hot pepper chili",
  "🍞": "bread",
  "🥐": "croissant",
  "🧀": "cheese",
  "🍖": "meat on bone",
  "🍗": "poultry leg chicken",
  "🥩": "cut of meat steak",
  "🥓": "bacon",
  "🍔": "hamburger burger",
  "🍟": "french fries",
  "🍕": "pizza",
  "🌭": "hot dog",
  "🥪": "sandwich",
  "🌮": "taco",
  "🌯": "burrito",
  "🥚": "egg",
  "🍳": "cooking fried egg",
  "🍿": "popcorn",
  "🍱": "bento box",
  "🍚": "rice",
  "🍜": "ramen noodles",
  "🍝": "spaghetti pasta",
  "🍣": "sushi",
  "🍦": "soft ice cream",
  "🍩": "doughnut donut",
  "🍪": "cookie",
  "🎂": "birthday cake",
  "🍰": "cake shortcake",
  "🍫": "chocolate bar",
  "🍬": "candy",
  "🍭": "lollipop",
  "☕": "coffee hot beverage",
  "🍵": "tea",
  "🍺": "beer mug",
  "🍷": "wine glass",
  "🥤": "cup with straw drink",
  "⚽": "soccer ball football",
  "🏀": "basketball",
  "🏈": "american football",
  "⚾": "baseball",
  "🎾": "tennis",
  "🏐": "volleyball",
  "🎱": "pool 8 ball billiards",
  "🏓": "ping pong table tennis",
  "🥊": "boxing glove",
  "🎮": "video game controller gaming",
  "🎯": "bullseye target dart",
  "🎲": "game die dice",
  "🎤": "microphone sing karaoke",
  "🎧": "headphone music",
  "🎸": "guitar music",
  "🎹": "musical keyboard piano",
  "🏆": "trophy award winner",
  "🥇": "gold medal first",
  "🥈": "silver medal second",
  "🥉": "bronze medal third",
  "🚗": "car automobile vehicle",
  "🚕": "taxi",
  "🚙": "sport utility vehicle suv",
  "🚌": "bus",
  "🚓": "police car",
  "🚑": "ambulance",
  "🚒": "fire engine truck",
  "🚚": "delivery truck",
  "🚲": "bicycle bike",
  "🏍️": "motorcycle",
  "✈️": "airplane plane flight",
  "🚀": "rocket space",
  "🛸": "flying saucer ufo",
  "⛵": "sailboat boat",
  "🚢": "ship",
  "🏠": "house home",
  "🏢": "office building",
  "🏫": "school",
  "🏥": "hospital",
  "🏦": "bank",
  "🏰": "castle",
  "🗼": "tokyo tower",
  "🗽": "statue of liberty",
  "🌍": "globe europe africa earth world",
  "🌎": "globe americas earth world",
  "🌏": "globe asia australia earth world",
  "💡": "light bulb idea",
  "🔦": "flashlight",
  "📱": "mobile phone smartphone",
  "💻": "laptop computer",
  "🖥️": "desktop computer",
  "⌨️": "keyboard",
  "🖱️": "computer mouse",
  "📷": "camera",
  "🎥": "movie camera video",
  "📺": "television tv",
  "📚": "books library",
  "📌": "pushpin pin",
  "📍": "round pushpin location",
  "✂️": "scissors cut",
  "🔒": "locked lock secure",
  "🔓": "unlocked lock",
  "🔑": "key",
  "💰": "money bag cash",
  "💳": "credit card",
  "💎": "gem stone diamond",
  "🔔": "bell notification",
  "🔇": "muted speaker sound off",
  "🔊": "speaker high volume sound",
  "❤️": "red heart love",
  "🧡": "orange heart love",
  "💛": "yellow heart love",
  "💚": "green heart love",
  "💙": "blue heart love",
  "💜": "purple heart love",
  "🖤": "black heart love",
  "🤍": "white heart love",
  "🤎": "brown heart love",
  "💔": "broken heart sad love",
  "💕": "two hearts love",
  "💖": "sparkling heart love",
  "💘": "heart with arrow cupid",
  "✅": "check mark button yes done",
  "❌": "cross mark no cancel x",
  "⭕": "hollow red circle",
  "💯": "hundred points 100 perfect",
  "❗": "exclamation mark warning",
  "❓": "question mark",
  "⚠️": "warning sign caution",
  "🚫": "prohibited no entry forbidden",
  "♻️": "recycling symbol",
  "🔴": "red circle",
  "🟠": "orange circle",
  "🟡": "yellow circle",
  "🟢": "green circle",
  "🔵": "blue circle",
  "🟣": "purple circle",
  "⚫": "black circle",
  "⚪": "white circle",
};

const FLAG_EMOJI_NAMES = {
  "🇹🇷": "turkey flag tr türkiye bayrak",
  "🇺🇸": "united states flag us usa america",
  "🇬🇧": "united kingdom flag gb uk britain england",
  "🇩🇪": "germany flag de german",
  "🇫🇷": "france flag fr french",
  "🇮🇹": "italy flag it italian",
  "🇪🇸": "spain flag es spanish",
  "🇵🇹": "portugal flag pt portuguese",
  "🇳🇱": "netherlands flag nl dutch",
  "🇧🇪": "belgium flag be",
  "🇨🇭": "switzerland flag ch swiss",
  "🇦🇹": "austria flag at",
  "🇩🇰": "denmark flag dk danish",
  "🇸🇪": "sweden flag se swedish",
  "🇳🇴": "norway flag no norwegian",
  "🇫🇮": "finland flag fi finnish",
  "🇮🇸": "iceland flag is",
  "🇮🇪": "ireland flag ie irish",
  "🇵🇱": "poland flag pl polish",
  "🇨🇿": "czech republic flag cz",
  "🇸🇰": "slovakia flag sk",
  "🇭🇺": "hungary flag hu hungarian",
  "🇷🇴": "romania flag ro romanian",
  "🇧🇬": "bulgaria flag bg bulgarian",
  "🇬🇷": "greece flag gr greek",
  "🇺🇦": "ukraine flag ua ukrainian",
  "🇷🇺": "russia flag ru russian",
  "🇯🇵": "japan flag jp japanese",
  "🇰🇷": "south korea flag kr korean",
  "🇨🇳": "china flag cn chinese",
  "🇮🇳": "india flag in indian",
  "🇵🇰": "pakistan flag pk pakistani",
  "🇧🇩": "bangladesh flag bd",
  "🇮🇩": "indonesia flag id indonesian",
  "🇲🇾": "malaysia flag my malaysian",
  "🇸🇬": "singapore flag sg",
  "🇹🇭": "thailand flag th thai",
  "🇵🇭": "philippines flag ph filipino",
  "🇻🇳": "vietnam flag vn vietnamese",
  "🇦🇺": "australia flag au australian",
  "🇳🇿": "new zealand flag nz",
  "🇨🇦": "canada flag ca canadian",
  "🇲🇽": "mexico flag mx mexican",
  "🇧🇷": "brazil flag br brazilian",
  "🇦🇷": "argentina flag ar argentinian",
  "🇨🇱": "chile flag cl chilean",
  "🇨🇴": "colombia flag co colombian",
  "🇵🇪": "peru flag pe peruvian",
  "🇿🇦": "south africa flag za",
  "🇪🇬": "egypt flag eg egyptian",
  "🇲🇦": "morocco flag ma moroccan",
  "🇳🇬": "nigeria flag ng nigerian",
  "🇸🇦": "saudi arabia flag sa",
  "🇦🇪": "united arab emirates flag ae uae",
  "🇶🇦": "qatar flag qa qatari",
  "🇮🇱": "israel flag il israeli",
  "🇮🇷": "iran flag ir iranian",
  "🇮🇶": "iraq flag iq iraqi",
  "🇦🇿": "azerbaijan flag az azeri",
  "🇬🇪": "georgia flag ge georgian",
  "🇦🇲": "armenia flag am armenian",
  "🇰🇿": "kazakhstan flag kz kazakh",
  "🇺🇿": "uzbekistan flag uz uzbek",
  "🇰🇬": "kyrgyzstan flag kg kyrgyz",
};

function createEmojiShortcode(value, fallbackName = "emoji") {
  const rawName = String(fallbackName || FALLBACK_EMOJI_NAMES[value] || FLAG_EMOJI_NAMES[value] || "emoji")
    .split(/[,;]/)[0]
    .trim()
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return rawName || "emoji";
}

function createFallbackEmojiItem(emoji, category) {
  const fallbackName = FLAG_EMOJI_NAMES[emoji] || FALLBACK_EMOJI_NAMES[emoji] || `${category.label} emoji`;

  return {
    emoji,
    label: fallbackName.split(/[,;]/)[0],
    shortcode: createEmojiShortcode(emoji, fallbackName),
    keywords: [fallbackName, category.label, ...category.keywords],
  };
}

function createFallbackEmojiCategories() {
  return EMOJI_CATEGORIES.map((category) => {
    return {
      ...category,
      emojis: category.emojis.map((emoji) => createFallbackEmojiItem(emoji, category)),
    };
  });
}

function getEmojiGroupId(entry) {
  if (typeof entry.group === "number") {
    const matchingGroup = EMOJI_GROUP_CONFIG.find((groupConfig) => {
      return groupConfig.groups.includes(entry.group);
    });

    if (matchingGroup) {
      return matchingGroup.id;
    }
  }

  const searchText = [entry.label, entry.annotation, entry.group, entry.subgroup]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase("en-US");

  if (searchText.includes("flag") || searchText.includes("country")) return "flags";
  if (searchText.includes("symbol") || searchText.includes("sign")) return "symbols";
  if (searchText.includes("object") || searchText.includes("tool")) return "objects";
  if (searchText.includes("activity") || searchText.includes("sport")) return "activity";
  if (searchText.includes("travel") || searchText.includes("place")) return "travel";
  if (searchText.includes("food") || searchText.includes("drink")) return "food";
  if (searchText.includes("animal") || searchText.includes("nature")) return "animals";
  if (searchText.includes("people") || searchText.includes("body") || searchText.includes("person")) return "people";

  return "smileys";
}

function normalizeExternalEmojiCategories(entries) {
  if (!Array.isArray(entries) || entries.length === 0) {
    return [];
  }

  const categoryMap = new Map(
    EMOJI_GROUP_CONFIG.map((groupConfig) => [
      groupConfig.id,
      {
        id: groupConfig.id,
        label: groupConfig.label,
        icon: groupConfig.icon,
        keywords: groupConfig.keywords,
        emojis: [],
      },
    ])
  );

  const seenEmojis = new Set();

  entries.forEach((entry) => {
    const emoji = entry.emoji || entry.unicode || "";

    if (!emoji || seenEmojis.has(emoji)) {
      return;
    }

    seenEmojis.add(emoji);

    const categoryId = getEmojiGroupId(entry);
    const category = categoryMap.get(categoryId) || categoryMap.get("smileys");
    const label =
      entry.label ||
      entry.annotation ||
      (Array.isArray(entry.shortcodes) ? entry.shortcodes[0] : "") ||
      FALLBACK_EMOJI_NAMES[emoji] ||
      FLAG_EMOJI_NAMES[emoji] ||
      "emoji";
    const shortcodes = Array.isArray(entry.shortcodes)
      ? entry.shortcodes
      : entry.shortcode
        ? [entry.shortcode]
        : [];
    const tags = Array.isArray(entry.tags) ? entry.tags : [];

    category.emojis.push({
      emoji,
      label,
      shortcode: createEmojiShortcode(emoji, shortcodes[0] || label),
      keywords: [
        label,
        FALLBACK_EMOJI_NAMES[emoji],
        FLAG_EMOJI_NAMES[emoji],
        ...shortcodes,
        ...tags,
        category.label,
        ...category.keywords,
      ].filter(Boolean),
    });
  });

  return Array.from(categoryMap.values()).filter((category) => category.emojis.length > 0);
}

function getEmojiSearchText(emojiItem, category) {
  return [
    emojiItem.emoji,
    emojiItem.label,
    emojiItem.shortcode,
    ...(emojiItem.keywords || []),
    category.label,
    ...(category.keywords || []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase("en-US");
}

function isFlagLikeEmoji(emoji) {
  const codePoints = Array.from(emoji).map((character) => character.codePointAt(0));
  const regionalIndicatorCount = codePoints.filter((codePoint) => {
    return codePoint >= 0x1f1e6 && codePoint <= 0x1f1ff;
  }).length;

  return regionalIndicatorCount >= 2 || emoji.includes("🏳") || emoji.includes("🏴") || emoji.includes("🚩") || emoji.includes("🎌");
}

function getTwemojiUrl(emoji) {
  const codePoints = Array.from(emoji).map((character) => character.codePointAt(0).toString(16));
  return `https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/${codePoints.join("-")}.svg`;
}

function EmojiGlyph({ emoji }) {
  const [imageFailed, setImageFailed] = useState(false);

  if (isFlagLikeEmoji(emoji) && !imageFailed) {
    return (
      <img
        className="emojiTwemojiImage"
        src={getTwemojiUrl(emoji)}
        alt={emoji}
        draggable="false"
        loading="lazy"
        onError={() => setImageFailed(true)}
      />
    );
  }

  return <span className="emojiNativeGlyph">{emoji}</span>;
}

const QUICK_GIFS = [
  {
    id: "cat-typing",
    title: "Cat typing",
    tags: ["cat", "kedi", "typing", "yazıyor", "çalışma"],
    url: "https://media.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif",
  },
  {
    id: "excited",
    title: "Excited",
    tags: ["happy", "mutlu", "heyecan", "yes", "reaction"],
    url: "https://media.giphy.com/media/111ebonMs90YLu/giphy.gif",
  },
  {
    id: "clap",
    title: "Clap",
    tags: ["clap", "alkış", "bravo", "good", "reaction"],
    url: "https://media.giphy.com/media/l3q2XhfQ8oCkm1Ts4/giphy.gif",
  },
  {
    id: "facepalm",
    title: "Facepalm",
    tags: ["facepalm", "oops", "hata", "reaction"],
    url: "https://media.giphy.com/media/3xz2BLBOt13X9AgjEA/giphy.gif",
  },
  {
    id: "mind-blown",
    title: "Mind blown",
    tags: ["mind blown", "wow", "şaşkın", "reaction"],
    url: "https://media.giphy.com/media/26ufdipQqU2lhNA4g/giphy.gif",
  },
  {
    id: "dance",
    title: "Dance",
    tags: ["dance", "dans", "party", "eğlence"],
    url: "https://media.giphy.com/media/GeimqsH0TLDt4tScGw/giphy.gif",
  },
  {
    id: "thumbs-up",
    title: "Thumbs up",
    tags: ["thumbs up", "ok", "tamam", "onay", "good"],
    url: "https://media.giphy.com/media/GCvktC0KFy9l6/giphy.gif",
  },
  {
    id: "nope",
    title: "Nope",
    tags: ["no", "hayır", "nope", "reaction"],
    url: "https://media.giphy.com/media/daPCSjwus6UR2JxRX1/giphy.gif",
  },
  {
    id: "laugh",
    title: "Laugh",
    tags: ["laugh", "gülmek", "lol", "komik"],
    url: "https://media.giphy.com/media/10JhviFuU2gWD6/giphy.gif",
  },
  {
    id: "hello",
    title: "Hello",
    tags: ["hello", "selam", "merhaba", "wave"],
    url: "https://media.giphy.com/media/ASd0Ukj0y3qMM/giphy.gif",
  },
  {
    id: "loading",
    title: "Loading",
    tags: ["loading", "bekle", "wait", "düşünüyor"],
    url: "https://media.giphy.com/media/3oEjI6SIIHBdRxXI40/giphy.gif",
  },
  {
    id: "fire",
    title: "Fire",
    tags: ["fire", "ateş", "lit", "efsane"],
    url: "https://media.giphy.com/media/3o72FfM5HJydzafgUE/giphy.gif",
  },
];


const GIF_CATEGORIES = [
  { id: "popular", title: "Popüler GIF'ler", query: "popular reaction" },
  { id: "hello", title: "Hello", query: "hello wave" },
  { id: "lol", title: "LOL", query: "lol funny laugh" },
  { id: "love", title: "Love", query: "love hearts" },
  { id: "birthday", title: "Happy birthday", query: "happy birthday" },
  { id: "cat", title: "Cat", query: "cat reaction" },
  { id: "dance", title: "Dance", query: "dance party" },
  { id: "wow", title: "Wow", query: "wow reaction" },
];

const DEFAULT_TEXT_CATEGORY_ID = "text_channels";
const DEFAULT_VOICE_CATEGORY_ID = "voice_channels";

const DEFAULT_CHANNEL_CATEGORIES = [
  { id: DEFAULT_TEXT_CATEGORY_ID, name: "Metin Kanalları", createdAt: 0 },
  { id: DEFAULT_VOICE_CATEGORY_ID, name: "Ses Kanalları", createdAt: 1 },
];

const DEFAULT_TEXT_CHANNELS = [
  { id: "general", name: "genel", categoryId: DEFAULT_TEXT_CATEGORY_ID },
  { id: "gaming", name: "oyun", categoryId: DEFAULT_TEXT_CATEGORY_ID },
  { id: "study", name: "ders", categoryId: DEFAULT_TEXT_CATEGORY_ID },
  { id: "random", name: "rastgele", categoryId: DEFAULT_TEXT_CATEGORY_ID },
];

const DEFAULT_VOICE_CHANNELS = [
  { id: "main_voice", name: "Sesli Sohbet", categoryId: DEFAULT_VOICE_CATEGORY_ID },
];

function hasExternalGifProvider() {
  if (GIF_PROVIDER === "tenor") {
    return Boolean(TENOR_API_KEY);
  }

  return Boolean(GIPHY_API_KEY);
}

function getFallbackGifs(searchText = "") {
  const cleanSearch = searchText.trim().toLocaleLowerCase("tr-TR");

  if (!cleanSearch) {
    return QUICK_GIFS;
  }

  return QUICK_GIFS.filter((gif) => {
    const searchableText = [gif.title, ...gif.tags]
      .join(" ")
      .toLocaleLowerCase("tr-TR");

    return searchableText.includes(cleanSearch);
  });
}

function normalizeGiphyGif(gif) {
  const original = gif?.images?.original;
  const fixedHeight = gif?.images?.fixed_height;
  const downsized = gif?.images?.downsized_medium;
  const url = original?.url || downsized?.url || fixedHeight?.url;
  const previewUrl = fixedHeight?.url || downsized?.url || original?.url;

  if (!url) {
    return null;
  }

  return {
    id: `giphy_${gif.id}`,
    title: gif.title || "GIF",
    url,
    previewUrl,
    source: "giphy",
  };
}

function normalizeTenorGif(result) {
  const gifMedia = result?.media_formats?.gif;
  const tinyGifMedia = result?.media_formats?.tinygif;
  const url = gifMedia?.url || tinyGifMedia?.url;
  const previewUrl = tinyGifMedia?.url || gifMedia?.url;

  if (!url) {
    return null;
  }

  return {
    id: `tenor_${result.id}`,
    title: result.content_description || result.title || "GIF",
    url,
    previewUrl,
    source: "tenor",
  };
}

function normalizeChannelName(value) {
  return value.trim().replace(/\s+/g, " ");
}

function slugifyChannelName(value) {
  const normalized = value
    .trim()
    .toLocaleLowerCase("tr-TR")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "kanal";
}

function createUniqueChannelId(type, channelName, existingChannels) {
  const prefix = type === "voice" ? "voice" : "text";
  const baseId = `${prefix}_${slugifyChannelName(channelName)}`;
  const existingIds = new Set(existingChannels.map((channel) => channel.id));

  if (!existingIds.has(baseId)) {
    return baseId;
  }

  for (let index = 2; index < 1000; index++) {
    const nextId = `${baseId}_${index}`;

    if (!existingIds.has(nextId)) {
      return nextId;
    }
  }

  return `${baseId}_${Date.now()}`;
}

function createUniqueCategoryId(categoryName, existingCategories) {
  const baseId = `category_${slugifyChannelName(categoryName)}`;
  const existingIds = new Set(existingCategories.map((category) => category.id));

  if (!existingIds.has(baseId)) {
    return baseId;
  }

  for (let index = 2; index < 1000; index++) {
    const nextId = `${baseId}_${index}`;

    if (!existingIds.has(nextId)) {
      return nextId;
    }
  }

  return `${baseId}_${Date.now()}`;
}

function getNormalizedCategories(rawCategories, fallbackCategories) {
  if (!Array.isArray(rawCategories) || rawCategories.length === 0) {
    return fallbackCategories;
  }

  const seenIds = new Set();
  const cleanCategories = rawCategories
    .map((category, index) => {
      const id = String(category?.id || "").trim();
      const name = normalizeChannelName(String(category?.name || ""));

      if (!id || !name || seenIds.has(id)) {
        return null;
      }

      seenIds.add(id);

      return {
        id,
        name,
        createdAt: category?.createdAt ?? index,
        updatedAt: category?.updatedAt || null,
      };
    })
    .filter(Boolean);

  return cleanCategories.length > 0 ? cleanCategories : fallbackCategories;
}

function getNormalizedChannels(
  rawChannels,
  fallbackChannels,
  fallbackCategoryId,
  validCategoryIds
) {
  const normalizeChannel = (channel, index) => {
    const id = String(channel?.id || "").trim();
    const name = normalizeChannelName(String(channel?.name || ""));

    if (!id || !name) {
      return null;
    }

    const rawCategoryId = String(channel?.categoryId || "").trim();
    const categoryId = validCategoryIds.has(rawCategoryId)
      ? rawCategoryId
      : fallbackCategoryId;

    return {
      id,
      name,
      categoryId,
      createdAt: channel?.createdAt ?? index,
      updatedAt: channel?.updatedAt || null,
    };
  };

  if (!Array.isArray(rawChannels) || rawChannels.length === 0) {
    return fallbackChannels.map(normalizeChannel).filter(Boolean);
  }

  const seenIds = new Set();
  const cleanChannels = rawChannels
    .map(normalizeChannel)
    .filter((channel) => {
      if (!channel || seenIds.has(channel.id)) {
        return false;
      }

      seenIds.add(channel.id);
      return true;
    });

  return cleanChannels.length > 0
    ? cleanChannels
    : fallbackChannels.map(normalizeChannel).filter(Boolean);
}

function getTimestampMillis(value) {
  if (!value) {
    return 0;
  }

  if (typeof value === "number") {
    return value;
  }

  if (typeof value.toMillis === "function") {
    return value.toMillis();
  }

  if (typeof value.seconds === "number") {
    return value.seconds * 1000;
  }

  return 0;
}

function RemoteAudio({ stream, muted = false }) {
  const audioRef = useRef(null);

  useEffect(() => {
    if (audioRef.current && stream) {
      audioRef.current.srcObject = stream;
    }
  }, [stream]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.muted = muted;
    }
  }, [muted]);

  return <audio ref={audioRef} autoPlay playsInline muted={muted} />;
}


function ScreenShareVideo({ stream, muted = false, videoRef, onVideoReady }) {
  const fallbackVideoRef = useRef(null);
  const activeVideoRef = videoRef || fallbackVideoRef;

  useEffect(() => {
    if (activeVideoRef.current && stream) {
      activeVideoRef.current.srcObject = stream;
    }
  }, [activeVideoRef, stream]);

  return (
    <video
      className="screenShareVideo"
      ref={activeVideoRef}
      autoPlay
      playsInline
      muted={muted}
      onLoadedData={onVideoReady}
      onLoadedMetadata={onVideoReady}
    />
  );
}

function ScreenShareViewerBox({ screenShare, muted, fullscreen = false }) {
  return (
    <div className={fullscreen ? "screenFullscreenViewer" : "screenShareViewer"}>
      <ScreenShareVideo stream={screenShare.stream} muted={muted} />
    </div>
  );
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
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [gifAttachments, setGifAttachments] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [emojiSearchText, setEmojiSearchText] = useState("");
  const [activeEmojiCategoryId, setActiveEmojiCategoryId] = useState("smileys");
  const [externalEmojiCategories, setExternalEmojiCategories] = useState([]);
  const [emojiDataLoading, setEmojiDataLoading] = useState(false);
  const [emojiDataError, setEmojiDataError] = useState("");
  const [hoveredEmojiName, setHoveredEmojiName] = useState("");
  const [gifPickerOpen, setGifPickerOpen] = useState(false);
  const [gifSearchText, setGifSearchText] = useState("");
  const [gifResults, setGifResults] = useState(() => getFallbackGifs(""));
  const [gifLoading, setGifLoading] = useState(false);
  const [gifError, setGifError] = useState("");
  const [gifActiveCategory, setGifActiveCategory] = useState("popular");
  const [messages, setMessages] = useState([]);
  const [members, setMembers] = useState([]);
  const [memberError, setMemberError] = useState("");
  const [presenceTick, setPresenceTick] = useState(() => Date.now());

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
  const [voiceServerMuted, setVoiceServerMuted] = useState(false);
  const [voiceDeafened, setVoiceDeafened] = useState(false);
  const [voiceServerDeafened, setVoiceServerDeafened] = useState(false);
  const [voiceParticipants, setVoiceParticipants] = useState([]);
  const [voiceStatus, setVoiceStatus] = useState("Sese katılmadın.");
  const [voiceError, setVoiceError] = useState("");
  const [remoteStreams, setRemoteStreams] = useState([]);
  const [remoteScreenStreams, setRemoteScreenStreams] = useState([]);
  const [localScreenStream, setLocalScreenStream] = useState(null);
  const [speakingUsers, setSpeakingUsers] = useState({});
  const [screenSharing, setScreenSharing] = useState(false);
  const [screenShareStarting, setScreenShareStarting] = useState(false);
  const [screenShareCollapsed, setScreenShareCollapsed] = useState(false);
  const [fullscreenScreenShareUid, setFullscreenScreenShareUid] = useState(null);
  const [activeVoiceChannelId, setActiveVoiceChannelId] = useState(null);
  const [channelActionLoading, setChannelActionLoading] = useState(false);
  const [moderationActionLoading, setModerationActionLoading] = useState(false);
  const [collapsedCategoryIds, setCollapsedCategoryIds] = useState({});
  const [openChannelCreateMenuId, setOpenChannelCreateMenuId] = useState(null);
  const [serverMenuOpen, setServerMenuOpen] = useState(false);

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const gifSearchAbortRef = useRef(null);
  const localStreamRef = useRef(null);
  const peerConnectionsRef = useRef(new Map());
  const pendingIceCandidatesRef = useRef(new Map());
  const signalUnsubscribeRef = useRef(null);
  const participantDocRef = useRef(null);
  const voiceRoomIdRef = useRef(null);
  const voiceChannelIdRef = useRef(null);
  const voiceJoinedRef = useRef(false);
  const voiceMutedRef = useRef(false);
  const voiceServerMutedRef = useRef(false);
  const voiceDeafenedRef = useRef(false);
  const voiceServerDeafenedRef = useRef(false);
  const voiceMutedBeforeDeafenRef = useRef(false);
  const voiceLeaveInProgressRef = useRef(false);
  const screenStreamRef = useRef(null);
  const screenSenderMapRef = useRef(new Map());
  const screenShareStopInProgressRef = useRef(false);
  const audioMonitorsRef = useRef(new Map());

  useEffect(() => {
    if (!openChannelCreateMenuId && !serverMenuOpen) {
      return undefined;
    }

    function handleDocumentClick(event) {
      if (!event.target.closest(".channelCreateMenuWrap")) {
        setOpenChannelCreateMenuId(null);
      }

      if (!event.target.closest(".serverMenuWrap")) {
        setServerMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleDocumentClick);

    return () => {
      document.removeEventListener("mousedown", handleDocumentClick);
    };
  }, [openChannelCreateMenuId, serverMenuOpen]);

  const activeServer =
    servers.find((server) => server.id === activeServerId) || null;

  const isActiveServerOwner =
    activeServer &&
    currentUser &&
    activeServer.createdByUid === currentUser.uid;

  const channelCategories = useMemo(() => {
    return getNormalizedCategories(
      activeServer?.channelCategories,
      DEFAULT_CHANNEL_CATEGORIES
    );
  }, [activeServer?.channelCategories]);

  const channelCategoryIds = useMemo(() => {
    return new Set(channelCategories.map((category) => category.id));
  }, [channelCategories]);

  const textChannels = useMemo(() => {
    return getNormalizedChannels(
      activeServer?.textChannels,
      DEFAULT_TEXT_CHANNELS,
      DEFAULT_TEXT_CATEGORY_ID,
      channelCategoryIds
    );
  }, [activeServer?.textChannels, channelCategoryIds]);

  const voiceChannels = useMemo(() => {
    return getNormalizedChannels(
      activeServer?.voiceChannels,
      DEFAULT_VOICE_CHANNELS,
      DEFAULT_VOICE_CATEGORY_ID,
      channelCategoryIds
    );
  }, [activeServer?.voiceChannels, channelCategoryIds]);

  const displayedChannelCategories = useMemo(() => {
    return channelCategories.map((category) => {
      return {
        ...category,
        textChannels: textChannels.filter((channel) => {
          return channel.categoryId === category.id;
        }),
        voiceChannels: voiceChannels.filter((channel) => {
          return channel.categoryId === category.id;
        }),
      };
    });
  }, [channelCategories, textChannels, voiceChannels]);

  const voiceChannelsKey = useMemo(() => {
    return voiceChannels.map((channel) => channel.id).join("|");
  }, [voiceChannels]);

  const activeChannelName =
    textChannels.find((channel) => channel.id === activeChannel)?.name ||
    textChannels[0]?.name ||
    "genel";

  const fallbackEmojiCategories = useMemo(() => {
    return createFallbackEmojiCategories();
  }, []);

  const emojiCategoriesForPicker =
    externalEmojiCategories.length > 0 ? externalEmojiCategories : fallbackEmojiCategories;

  const activeEmojiCategory = useMemo(() => {
    return (
      emojiCategoriesForPicker.find((category) => {
        return category.id === activeEmojiCategoryId;
      }) || emojiCategoriesForPicker[0]
    );
  }, [activeEmojiCategoryId, emojiCategoriesForPicker]);

  const displayedEmojiGroups = useMemo(() => {
    const cleanSearch = emojiSearchText.trim().toLocaleLowerCase("en-US");

    if (!cleanSearch) {
      return activeEmojiCategory ? [activeEmojiCategory] : [];
    }

    return emojiCategoriesForPicker
      .map((category) => {
        const categoryMatches = [category.label, ...category.keywords].some((value) => {
          return String(value).toLocaleLowerCase("en-US").includes(cleanSearch);
        });

        return {
          ...category,
          emojis: categoryMatches
            ? category.emojis
            : category.emojis.filter((emojiItem) => {
                return getEmojiSearchText(emojiItem, category).includes(cleanSearch);
              }),
        };
      })
      .filter((category) => category.emojis.length > 0);
  }, [activeEmojiCategory, emojiCategoriesForPicker, emojiSearchText]);

  const filteredMessages = messages.filter(
    (message) => message.channel === activeChannel
  );

  const currentVoiceParticipants = useMemo(() => {
    return voiceParticipants.filter((participant) => {
      return (
        participant.serverId === activeServerId &&
        participant.channelId === activeVoiceChannelId
      );
    });
  }, [voiceParticipants, activeServerId, activeVoiceChannelId]);

  const activeScreenShares = useMemo(() => {
    if (!activeServerId || !activeVoiceChannelId) {
      return [];
    }

    const screenSharingParticipants = currentVoiceParticipants.filter(
      (participant) => participant.screenSharing
    );

    return screenSharingParticipants
      .map((participant) => {
        const isLocalShare = participant.uid === currentUser?.uid;
        const remoteScreenStream = remoteScreenStreams.find((screenStream) => {
          return screenStream.uid === participant.uid;
        });

        return {
          ...participant,
          isLocalShare,
          stream: isLocalShare ? localScreenStream : remoteScreenStream?.stream || null,
        };
      })
      .sort((a, b) => {
        if (a.isLocalShare && !b.isLocalShare) {
          return -1;
        }

        if (!a.isLocalShare && b.isLocalShare) {
          return 1;
        }

        return (a.displayName || "").localeCompare(b.displayName || "");
      });
  }, [
    activeServerId,
    activeVoiceChannelId,
    currentUser?.uid,
    currentVoiceParticipants,
    localScreenStream,
    remoteScreenStreams,
  ]);


  const displayedMembers = useMemo(() => {
    return members
      .filter((member) => member.removed !== true)
      .map((member) => {
        const lastSeenAt = Math.max(
          getTimestampMillis(member.lastSeen),
          getTimestampMillis(member.presenceUpdatedAt)
        );
        const isCurrentMember = member.uid === currentUser?.uid;
        const isRecentlySeen =
          lastSeenAt > 0 && presenceTick - lastSeenAt < ONLINE_TIMEOUT_MS;

        return {
          ...member,
          lastSeenAt,
          isOnline: isCurrentMember || (member.online === true && isRecentlySeen),
        };
      })
      .sort((a, b) => {
        if (a.isOnline !== b.isOnline) {
          return a.isOnline ? -1 : 1;
        }

        if (a.role === "owner" && b.role !== "owner") {
          return -1;
        }

        if (a.role !== "owner" && b.role === "owner") {
          return 1;
        }

        return (a.displayName || "").localeCompare(b.displayName || "");
      });
  }, [members, presenceTick, currentUser?.uid]);

  const onlineMembers = displayedMembers.filter((member) => {
    return member.isOnline;
  });

  const offlineMembers = displayedMembers.filter((member) => {
    return !member.isOnline;
  });

  const onlineMemberCount = onlineMembers.length;
  const offlineMemberCount = offlineMembers.length;
  const activeMemberCount = displayedMembers.length;

  const fullscreenScreenShare = useMemo(() => {
    if (!fullscreenScreenShareUid) {
      return null;
    }

    return (
      activeScreenShares.find((screenShare) => {
        return screenShare.uid === fullscreenScreenShareUid;
      }) || null
    );
  }, [activeScreenShares, fullscreenScreenShareUid]);

  function getVoiceParticipantsForChannel(channelId) {
    return voiceParticipants.filter((participant) => {
      return (
        participant.serverId === activeServerId && participant.channelId === channelId
      );
    });
  }

  function selectTextChannel(channelId) {
    setActiveChannel(channelId);

    if (activeScreenShares.length > 0) {
      setScreenShareCollapsed(true);
    }
  }

  function getCurrentTime() {
    const now = new Date();
    const hour = String(now.getHours()).padStart(2, "0");
    const minute = String(now.getMinutes()).padStart(2, "0");
    return `${hour}:${minute}`;
  }

  function formatFileSize(bytes = 0) {
    if (!bytes) {
      return "0 B";
    }

    const units = ["B", "KB", "MB", "GB"];
    const unitIndex = Math.min(
      Math.floor(Math.log(bytes) / Math.log(1024)),
      units.length - 1
    );
    const value = bytes / 1024 ** unitIndex;

    return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
  }

  function getAttachmentType(contentType = "", fileName = "") {
    const cleanContentType = contentType.toLowerCase();
    const cleanFileName = fileName.toLowerCase();

    if (cleanContentType.startsWith("image/") || cleanFileName.endsWith(".gif")) {
      return cleanContentType.includes("gif") || cleanFileName.endsWith(".gif")
        ? "gif"
        : "image";
    }

    if (cleanContentType.startsWith("video/")) {
      return "video";
    }

    return "file";
  }

  function sanitizeFileName(fileName) {
    return String(fileName || "dosya")
      .replace(/[^a-zA-Z0-9ğüşıöçĞÜŞİÖÇ._-]+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 90);
  }

  function getMessageAttachments(message) {
    return Array.isArray(message.attachments) ? message.attachments : [];
  }

  function getServerInitial(serverName) {
    return (serverName || "Z").charAt(0).toUpperCase();
  }

  function getUserInitial(displayName) {
    return (displayName || "G").charAt(0).toUpperCase();
  }

  function getMemberName(member) {
    return member?.displayName || member?.email || "Guest";
  }

  function getMemberRoleLabel(member) {
    return member?.role === "owner" ? "Sunucu sahibi" : "Üye";
  }

  function renderMemberItem(member) {
    const isCurrentMember = member.uid === currentUser?.uid;
    const roleLabel = getMemberRoleLabel(member);

    return (
      <div
        className={member.isOnline ? "memberItem online" : "memberItem offline"}
        key={member.id}
      >
        <div className="memberAvatarWrap">
          <div className="memberAvatar">{getUserInitial(member.displayName)}</div>
          <span
            className={
              member.isOnline
                ? "memberStatusDot online"
                : "memberStatusDot offline"
            }
            title={member.isOnline ? "Çevrimiçi" : "Çevrimdışı"}
          />
        </div>

        <div className="memberInfo">
          <div className="memberNameRow">
            <strong>{getMemberName(member)}</strong>
            {member.role === "owner" && (
              <span className="memberOwnerCrown" title="Sunucu sahibi">
                👑
              </span>
            )}
            {isCurrentMember && <span className="memberSelfTag">Sen</span>}
          </div>
          <span>{roleLabel}</span>
        </div>

        {isActiveServerOwner &&
          member.uid !== currentUser?.uid &&
          member.role !== "owner" && (
            <button
              className="memberKickButton"
              onClick={() => kickMemberFromServer(member)}
              disabled={moderationActionLoading}
              title="Üyeyi sunucudan at"
            >
              At
            </button>
          )}
      </div>
    );
  }

  function setLocalMicrophoneEnabled(enabled) {
    if (!localStreamRef.current) {
      return;
    }

    localStreamRef.current.getAudioTracks().forEach((track) => {
      track.enabled = enabled;
    });
  }

  function applyVoiceMuteState(nextMuted) {
    voiceMutedRef.current = nextMuted;
    setVoiceMuted(nextMuted);
    setLocalMicrophoneEnabled(!nextMuted && !voiceServerMutedRef.current);
  }

  function applyVoiceDeafenState(nextDeafened) {
    voiceDeafenedRef.current = nextDeafened;
    setVoiceDeafened(nextDeafened);
  }

  async function updateCurrentVoiceParticipant(fields) {
    if (!participantDocRef.current) {
      return;
    }

    try {
      await updateDoc(participantDocRef.current, {
        ...fields,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.warn("Ses katılımcısı durumu güncellenemedi:", error);
    }
  }

  function setUserSpeaking(uid, isSpeaking) {
    setSpeakingUsers((previousSpeakingUsers) => {
      if (previousSpeakingUsers[uid] === isSpeaking) {
        return previousSpeakingUsers;
      }

      return {
        ...previousSpeakingUsers,
        [uid]: isSpeaking,
      };
    });
  }

  function stopAudioLevelMonitor(uid) {
    const monitor = audioMonitorsRef.current.get(uid);

    if (!monitor) {
      return;
    }

    cancelAnimationFrame(monitor.animationFrameId);

    try {
      monitor.source.disconnect();
    } catch (error) {
      console.warn("Ses analiz kaynağı kapatılamadı:", error);
    }

    if (monitor.audioContext.state !== "closed") {
      monitor.audioContext.close().catch((error) => {
        console.warn("Ses analiz context'i kapatılamadı:", error);
      });
    }

    audioMonitorsRef.current.delete(uid);
    setUserSpeaking(uid, false);
  }

  function startAudioLevelMonitor(uid, stream) {
    if (!uid || !stream) {
      return;
    }

    const AudioContextConstructor =
      window.AudioContext || window.webkitAudioContext;

    if (!AudioContextConstructor) {
      return;
    }

    stopAudioLevelMonitor(uid);

    try {
      const audioContext = new AudioContextConstructor();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);

      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.65;

      const dataArray = new Uint8Array(analyser.fftSize);

      source.connect(analyser);

      const monitor = {
        audioContext,
        analyser,
        source,
        dataArray,
        animationFrameId: null,
        lastSpeaking: false,
        lastUpdateTime: 0,
      };

      audioMonitorsRef.current.set(uid, monitor);

      if (audioContext.state === "suspended") {
        audioContext.resume().catch((error) => {
          console.warn("Ses analiz context'i başlatılamadı:", error);
        });
      }

      function checkAudioLevel() {
        const currentMonitor = audioMonitorsRef.current.get(uid);

        if (!currentMonitor) {
          return;
        }

        analyser.getByteTimeDomainData(dataArray);

        let sum = 0;

        for (const value of dataArray) {
          const centeredValue = value - 128;
          sum += centeredValue * centeredValue;
        }

        const rms = Math.sqrt(sum / dataArray.length);
        const hasLiveAudioTrack = stream.getAudioTracks().some((track) => {
          return track.readyState === "live" && track.enabled;
        });
        const nextSpeaking = hasLiveAudioTrack && rms > 8;
        const now = Date.now();
        const shouldUpdate =
          nextSpeaking !== currentMonitor.lastSpeaking ||
          now - currentMonitor.lastUpdateTime > 350;

        if (shouldUpdate) {
          currentMonitor.lastSpeaking = nextSpeaking;
          currentMonitor.lastUpdateTime = now;
          setUserSpeaking(uid, nextSpeaking);
        }

        currentMonitor.animationFrameId = requestAnimationFrame(checkAudioLevel);
      }

      monitor.animationFrameId = requestAnimationFrame(checkAudioLevel);
    } catch (error) {
      console.warn("Ses seviyesi ölçülemedi:", error);
      stopAudioLevelMonitor(uid);
    }
  }

  function getMemberDocumentId(serverId, uid) {
    return `${serverId}_${uid}`;
  }

  function getVoiceRoomId(serverId, voiceChannelId = "main_voice") {
    return `${serverId}_${voiceChannelId}`;
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
        role,
        removed: false,
        kicked: false,
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
      online: true,
      lastSeen: serverTimestamp(),
      presenceUpdatedAt: serverTimestamp(),
      joinedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  async function updateCurrentMemberPresence(isOnline) {
    if (!currentUser || !activeServer) {
      return;
    }

    const cleanUsername = username.trim() || "Guest";
    const role =
      activeServer.createdByUid === currentUser.uid
        ? "owner"
        : activeServer.role || "member";
    const memberRef = doc(
      db,
      "members",
      getMemberDocumentId(activeServer.id, currentUser.uid)
    );

    await setDoc(
      memberRef,
      {
        serverId: activeServer.id,
        uid: currentUser.uid,
        email: currentUser.email,
        displayName: cleanUsername,
        role,
        online: isOnline,
        lastSeen: serverTimestamp(),
        presenceUpdatedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
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
        textChannels: DEFAULT_TEXT_CHANNELS,
        voiceChannels: DEFAULT_VOICE_CHANNELS,
        channelCategories: DEFAULT_CHANNEL_CATEGORIES,
        createdByUid: currentUser.uid,
        createdByEmail: currentUser.email,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
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

  async function updateServerChannels(
    nextTextChannels,
    nextVoiceChannels,
    nextChannelCategories = channelCategories
  ) {
    if (!currentUser || !activeServer || !isActiveServerOwner) {
      alert("Kanalları sadece sunucu sahibi düzenleyebilir.");
      return;
    }

    await updateDoc(doc(db, "servers", activeServer.id), {
      textChannels: nextTextChannels,
      voiceChannels: nextVoiceChannels,
      channelCategories: nextChannelCategories,
      updatedAt: serverTimestamp(),
    });
  }

  function toggleChannelCategory(categoryId) {
    setCollapsedCategoryIds((previousCategoryIds) => {
      return {
        ...previousCategoryIds,
        [categoryId]: !previousCategoryIds[categoryId],
      };
    });
  }

  function toggleChannelCreateMenu(categoryId) {
    setOpenChannelCreateMenuId((previousCategoryId) => {
      return previousCategoryId === categoryId ? null : categoryId;
    });
  }

  function handleChannelCreateMenuAction(type, categoryId) {
    setOpenChannelCreateMenuId(null);
    addChannel(type, categoryId);
  }

  async function addChannelCategory() {
    if (!isActiveServerOwner || channelActionLoading) {
      return;
    }

    const rawName = prompt("Yeni kanal başlığının adı ne olsun?");

    if (rawName === null) {
      return;
    }

    const cleanName = normalizeChannelName(rawName);

    if (cleanName.length < 2) {
      alert("Başlık adı en az 2 karakter olmalı.");
      return;
    }

    if (cleanName.length > 28) {
      alert("Başlık adı en fazla 28 karakter olabilir.");
      return;
    }

    const alreadyExists = channelCategories.some((category) => {
      return category.name.toLocaleLowerCase("tr-TR") === cleanName.toLocaleLowerCase("tr-TR");
    });

    if (alreadyExists) {
      alert("Bu isimde bir başlık zaten var.");
      return;
    }

    const newCategory = {
      id: createUniqueCategoryId(cleanName, channelCategories),
      name: cleanName,
      createdAt: Date.now(),
    };

    try {
      setChannelActionLoading(true);
      await updateServerChannels(textChannels, voiceChannels, [
        ...channelCategories,
        newCategory,
      ]);
      setCollapsedCategoryIds((previousCategoryIds) => {
        return {
          ...previousCategoryIds,
          [newCategory.id]: false,
        };
      });
    } catch (error) {
      console.error("Kanal başlığı eklenemedi:", error);
      alert("Kanal başlığı eklenemedi. Firebase Rules veya bağlantı ayarlarını kontrol et.");
    } finally {
      setChannelActionLoading(false);
    }
  }

  async function renameChannelCategory(categoryId) {
    if (!isActiveServerOwner || channelActionLoading) {
      return;
    }

    const editedCategory = channelCategories.find((category) => category.id === categoryId);

    if (!editedCategory) {
      return;
    }

    const rawName = prompt(
      `${editedCategory.name} başlığının yeni adı ne olsun?`,
      editedCategory.name
    );

    if (rawName === null) {
      return;
    }

    const cleanName = normalizeChannelName(rawName);

    if (cleanName.length < 2) {
      alert("Başlık adı en az 2 karakter olmalı.");
      return;
    }

    if (cleanName.length > 28) {
      alert("Başlık adı en fazla 28 karakter olabilir.");
      return;
    }

    const sameName =
      editedCategory.name.toLocaleLowerCase("tr-TR") ===
      cleanName.toLocaleLowerCase("tr-TR");

    if (sameName) {
      return;
    }

    const alreadyExists = channelCategories.some((category) => {
      return (
        category.id !== categoryId &&
        category.name.toLocaleLowerCase("tr-TR") ===
          cleanName.toLocaleLowerCase("tr-TR")
      );
    });

    if (alreadyExists) {
      alert("Bu isimde bir başlık zaten var.");
      return;
    }

    const nextCategories = channelCategories.map((category) => {
      if (category.id !== categoryId) {
        return category;
      }

      return {
        ...category,
        name: cleanName,
        updatedAt: Date.now(),
      };
    });

    try {
      setChannelActionLoading(true);
      await updateServerChannels(textChannels, voiceChannels, nextCategories);
    } catch (error) {
      console.error("Kanal başlığı değiştirilemedi:", error);
      alert("Kanal başlığı değiştirilemedi. Firebase Rules veya bağlantı ayarlarını kontrol et.");
    } finally {
      setChannelActionLoading(false);
    }
  }

  async function deleteChannelCategory(categoryId) {
    if (!isActiveServerOwner || channelActionLoading) {
      return;
    }

    const deletedCategory = channelCategories.find((category) => category.id === categoryId);

    if (!deletedCategory) {
      return;
    }

    if (channelCategories.length <= 1) {
      alert("Son başlığı silemezsin. Önce yeni bir başlık oluştur.");
      return;
    }

    const fallbackCategory = channelCategories.find((category) => {
      return category.id !== categoryId;
    });

    if (!fallbackCategory) {
      return;
    }

    const textChannelCount = textChannels.filter((channel) => channel.categoryId === categoryId).length;
    const voiceChannelCount = voiceChannels.filter((channel) => channel.categoryId === categoryId).length;
    const containsChannels = textChannelCount + voiceChannelCount > 0;
    const shouldDelete = confirm(
      containsChannels
        ? `${deletedCategory.name} başlığı silinsin mi? İçindeki kanallar ${fallbackCategory.name} başlığına taşınacak.`
        : `${deletedCategory.name} başlığı silinsin mi?`
    );

    if (!shouldDelete) {
      return;
    }

    const nextCategories = channelCategories.filter((category) => category.id !== categoryId);
    const moveChannelToFallback = (channel) => {
      if (channel.categoryId !== categoryId) {
        return channel;
      }

      return {
        ...channel,
        categoryId: fallbackCategory.id,
        updatedAt: Date.now(),
      };
    };

    try {
      setChannelActionLoading(true);
      await updateServerChannels(
        textChannels.map(moveChannelToFallback),
        voiceChannels.map(moveChannelToFallback),
        nextCategories
      );
      setCollapsedCategoryIds((previousCategoryIds) => {
        const nextCategoryIds = { ...previousCategoryIds };
        delete nextCategoryIds[categoryId];
        return nextCategoryIds;
      });
    } catch (error) {
      console.error("Kanal başlığı silinemedi:", error);
      alert("Kanal başlığı silinemedi. Firebase Rules veya bağlantı ayarlarını kontrol et.");
    } finally {
      setChannelActionLoading(false);
    }
  }

  async function addChannel(type, categoryId) {
    setOpenChannelCreateMenuId(null);

    if (!isActiveServerOwner || channelActionLoading) {
      return;
    }

    const targetCategoryId = channelCategoryIds.has(categoryId)
      ? categoryId
      : channelCategories[0]?.id;

    if (!targetCategoryId) {
      alert("Önce bir kanal başlığı oluşturmalısın.");
      return;
    }

    const label = type === "voice" ? "ses" : "metin";
    const rawName = prompt(`Yeni ${label} kanalı adı ne olsun?`);

    if (rawName === null) {
      return;
    }

    const cleanName = normalizeChannelName(rawName);

    if (cleanName.length < 2) {
      alert("Kanal adı en az 2 karakter olmalı.");
      return;
    }

    if (cleanName.length > 24) {
      alert("Kanal adı en fazla 24 karakter olabilir.");
      return;
    }

    const existingChannels = type === "voice" ? voiceChannels : textChannels;
    const alreadyExists = existingChannels.some((channel) => {
      return channel.name.toLocaleLowerCase("tr-TR") === cleanName.toLocaleLowerCase("tr-TR");
    });

    if (alreadyExists) {
      alert("Bu isimde bir kanal zaten var.");
      return;
    }

    const newChannel = {
      id: createUniqueChannelId(type, cleanName, existingChannels),
      name: cleanName,
      categoryId: targetCategoryId,
      createdAt: Date.now(),
    };

    try {
      setChannelActionLoading(true);

      if (type === "voice") {
        await updateServerChannels(textChannels, [...voiceChannels, newChannel]);
        setCollapsedCategoryIds((previousCategoryIds) => {
          return { ...previousCategoryIds, [targetCategoryId]: false };
        });
        return;
      }

      await updateServerChannels([...textChannels, newChannel], voiceChannels);
      setCollapsedCategoryIds((previousCategoryIds) => {
        return { ...previousCategoryIds, [targetCategoryId]: false };
      });
      setActiveChannel(newChannel.id);
    } catch (error) {
      console.error("Kanal eklenemedi:", error);
      alert("Kanal eklenemedi. Firebase Rules veya bağlantı ayarlarını kontrol et.");
    } finally {
      setChannelActionLoading(false);
    }
  }

  async function renameChannel(type, channelId) {
    if (!isActiveServerOwner || channelActionLoading) {
      return;
    }

    const existingChannels = type === "voice" ? voiceChannels : textChannels;
    const editedChannel = existingChannels.find((channel) => channel.id === channelId);

    if (!editedChannel) {
      return;
    }

    const label = type === "voice" ? "ses" : "metin";
    const rawName = prompt(
      `${editedChannel.name} ${label} kanalının yeni adı ne olsun?`,
      editedChannel.name
    );

    if (rawName === null) {
      return;
    }

    const cleanName = normalizeChannelName(rawName);

    if (cleanName.length < 2) {
      alert("Kanal adı en az 2 karakter olmalı.");
      return;
    }

    if (cleanName.length > 24) {
      alert("Kanal adı en fazla 24 karakter olabilir.");
      return;
    }

    const sameName =
      editedChannel.name.toLocaleLowerCase("tr-TR") ===
      cleanName.toLocaleLowerCase("tr-TR");

    if (sameName) {
      return;
    }

    const alreadyExists = existingChannels.some((channel) => {
      return (
        channel.id !== channelId &&
        channel.name.toLocaleLowerCase("tr-TR") ===
          cleanName.toLocaleLowerCase("tr-TR")
      );
    });

    if (alreadyExists) {
      alert("Bu isimde bir kanal zaten var.");
      return;
    }

    const nextChannels = existingChannels.map((channel) => {
      if (channel.id !== channelId) {
        return channel;
      }

      return {
        ...channel,
        name: cleanName,
        updatedAt: Date.now(),
      };
    });

    try {
      setChannelActionLoading(true);

      if (type === "voice") {
        await updateServerChannels(textChannels, nextChannels);

        const roomId = getVoiceRoomId(activeServer.id, channelId);

        await setDoc(
          doc(db, "voiceRooms", roomId),
          {
            serverId: activeServer.id,
            channelId,
            name: cleanName,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );

        const participantsRef = collection(
          db,
          "voiceRooms",
          roomId,
          "participants"
        );
        const participantsSnapshot = await getDocs(participantsRef);
        const participantUpdates = participantsSnapshot.docs.map((participantDoc) => {
          return updateDoc(participantDoc.ref, {
            voiceChannelName: cleanName,
            updatedAt: serverTimestamp(),
          });
        });

        await Promise.all(participantUpdates);

        if (voiceJoined && activeVoiceChannelId === channelId) {
          setVoiceStatus(`${cleanName} ses kanalındasın.`);
        }

        return;
      }

      await updateServerChannels(nextChannels, voiceChannels);
    } catch (error) {
      console.error("Kanal adı değiştirilemedi:", error);
      alert("Kanal adı değiştirilemedi. Firebase Rules veya bağlantı ayarlarını kontrol et.");
    } finally {
      setChannelActionLoading(false);
    }
  }

  async function deleteChannel(type, channelId) {
    if (!isActiveServerOwner || channelActionLoading) {
      return;
    }

    const existingChannels = type === "voice" ? voiceChannels : textChannels;
    const deletedChannel = existingChannels.find((channel) => channel.id === channelId);

    if (!deletedChannel) {
      return;
    }

    if (existingChannels.length <= 1) {
      alert("Son kanalı silemezsin. Önce yeni bir kanal oluştur.");
      return;
    }

    const label = type === "voice" ? "ses" : "metin";
    const shouldDelete = confirm(
      `#${deletedChannel.name} ${label} kanalı silinsin mi?`
    );

    if (!shouldDelete) {
      return;
    }

    const nextChannels = existingChannels.filter((channel) => channel.id !== channelId);

    try {
      setChannelActionLoading(true);

      if (type === "voice") {
        if (voiceJoined && activeVoiceChannelId === channelId) {
          await leaveVoiceRoom();
        }

        await updateServerChannels(textChannels, nextChannels);
        return;
      }

      if (activeChannel === channelId) {
        setActiveChannel(nextChannels[0]?.id || "general");
      }

      await updateServerChannels(nextChannels, voiceChannels);
    } catch (error) {
      console.error("Kanal silinemedi:", error);
      alert("Kanal silinemedi. Firebase Rules veya bağlantı ayarlarını kontrol et.");
    } finally {
      setChannelActionLoading(false);
    }
  }

  function openFilePicker() {
    fileInputRef.current?.click();
  }

  function handleFileSelection(event) {
    const files = Array.from(event.target.files || []);

    if (files.length === 0) {
      return;
    }

    const allowedFiles = [];
    const rejectedFiles = [];

    files.forEach((file) => {
      if (file.size > MAX_UPLOAD_SIZE_BYTES) {
        rejectedFiles.push(file.name);
        return;
      }

      allowedFiles.push(file);
    });

    if (rejectedFiles.length > 0) {
      alert(
        `Bazı dosyalar ${MAX_UPLOAD_SIZE_LABEL} sınırını geçtiği için eklenmedi:\n${rejectedFiles.join("\n")}`
      );
    }

    setSelectedFiles((previousFiles) => [...previousFiles, ...allowedFiles]);
    event.target.value = "";
  }

  function removeSelectedFile(indexToRemove) {
    setSelectedFiles((previousFiles) => {
      return previousFiles.filter((_, index) => index !== indexToRemove);
    });
  }

  async function loadGifResults(searchText = "") {
    const cleanSearch = searchText.trim();

    if (gifSearchAbortRef.current) {
      gifSearchAbortRef.current.abort();
    }

    if (!hasExternalGifProvider()) {
      setGifResults(getFallbackGifs(cleanSearch));
      setGifLoading(false);
      setGifError(
        "Sınırsız GIF araması için VITE_GIPHY_API_KEY veya VITE_TENOR_API_KEY ekle. Şimdilik hazır GIF havuzu gösteriliyor."
      );
      return;
    }

    const abortController = new AbortController();
    gifSearchAbortRef.current = abortController;
    setGifLoading(true);
    setGifError("");

    try {
      let requestUrl = "";

      if (GIF_PROVIDER === "tenor") {
        const params = new URLSearchParams({
          key: TENOR_API_KEY,
          client_key: GIF_CLIENT_KEY,
          limit: String(GIF_RESULT_LIMIT),
          media_filter: "gif,tinygif",
          contentfilter: "medium",
          locale: "tr_TR",
        });

        if (cleanSearch) {
          params.set("q", cleanSearch);
          requestUrl = `https://tenor.googleapis.com/v2/search?${params.toString()}`;
        } else {
          requestUrl = `https://tenor.googleapis.com/v2/featured?${params.toString()}`;
        }
      } else {
        const params = new URLSearchParams({
          api_key: GIPHY_API_KEY,
          limit: String(GIF_RESULT_LIMIT),
          rating: "pg-13",
          lang: "tr",
        });

        if (cleanSearch) {
          params.set("q", cleanSearch);
          requestUrl = `https://api.giphy.com/v1/gifs/search?${params.toString()}`;
        } else {
          requestUrl = `https://api.giphy.com/v1/gifs/trending?${params.toString()}`;
        }
      }

      const response = await fetch(requestUrl, {
        signal: abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`GIF API yanıtı başarısız: ${response.status}`);
      }

      const data = await response.json();
      const externalGifs =
        GIF_PROVIDER === "tenor"
          ? (data.results || []).map(normalizeTenorGif).filter(Boolean)
          : (data.data || []).map(normalizeGiphyGif).filter(Boolean);

      if (externalGifs.length === 0) {
        setGifResults(getFallbackGifs(cleanSearch));
        setGifError("Bu aramada dış GIF sonucu bulunamadı; hazır havuz gösteriliyor.");
        return;
      }

      setGifResults(externalGifs);
    } catch (error) {
      if (error.name === "AbortError") {
        return;
      }

      console.error("GIF sonuçları alınamadı:", error);
      setGifResults(getFallbackGifs(cleanSearch));
      setGifError("GIF sitesinden sonuç alınamadı; hazır havuz gösteriliyor.");
    } finally {
      if (gifSearchAbortRef.current === abortController) {
        gifSearchAbortRef.current = null;
        setGifLoading(false);
      }
    }
  }

  function selectGifCategory(category) {
    setGifActiveCategory(category.id);
    setGifSearchText(category.query);
  }

  useEffect(() => {
    if (!gifPickerOpen) {
      return undefined;
    }

    const searchTimer = window.setTimeout(() => {
      loadGifResults(gifSearchText);
    }, GIF_SEARCH_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(searchTimer);
    };
  }, [gifPickerOpen, gifSearchText]);

  useEffect(() => {
    let cancelled = false;

    async function loadExternalEmojiData() {
      setEmojiDataLoading(true);
      setEmojiDataError("");

      try {
        const response = await fetch(EMOJIBASE_DATA_URL);

        if (!response.ok) {
          throw new Error(`Emoji verisi alınamadı: ${response.status}`);
        }

        const emojiEntries = await response.json();
        const normalizedCategories = normalizeExternalEmojiCategories(emojiEntries);

        if (!cancelled && normalizedCategories.length > 0) {
          setExternalEmojiCategories(normalizedCategories);
        }
      } catch (error) {
        console.warn("Harici emoji verisi alınamadı, yedek emoji listesi kullanılacak:", error);

        if (!cancelled) {
          setEmojiDataError("Emoji verisi alınamadı; yedek liste gösteriliyor.");
        }
      } finally {
        if (!cancelled) {
          setEmojiDataLoading(false);
        }
      }
    }

    loadExternalEmojiData();

    return () => {
      cancelled = true;
    };
  }, []);

  function addEmojiToMessage(emojiItem) {
    const emoji = typeof emojiItem === "string" ? emojiItem : emojiItem.emoji;
    setMessageText((previousText) => `${previousText}${emoji}`);
    setHoveredEmojiName(typeof emojiItem === "string" ? "" : `:${emojiItem.shortcode}:`);
  }

  function selectEmojiCategory(categoryId) {
    setActiveEmojiCategoryId(categoryId);
    setEmojiSearchText("");
    setHoveredEmojiName("");
  }

  function toggleEmojiPicker() {
    setEmojiPickerOpen((previousState) => {
      const nextState = !previousState;

      if (nextState) {
        setEmojiSearchText("");
        setHoveredEmojiName("");
      }

      return nextState;
    });
    setGifPickerOpen(false);
  }

  function toggleGifPicker() {
    setGifPickerOpen((previousState) => {
      const nextState = !previousState;

      if (nextState) {
        setGifError("");
      }

      return nextState;
    });
    setEmojiPickerOpen(false);
  }

  async function sendGifFromPicker(gif) {
    if (!gif || !currentUser || !activeServerId || isSending) {
      return;
    }

    const cleanUsername = username.trim() || "Guest";
    const gifAttachment = {
      id: `gif_${gif.id || gif.url || "selected"}`,
      name: gif.title || "GIF",
      url: gif.url,
      previewUrl: gif.previewUrl || gif.url,
      contentType: gif.url.toLowerCase().includes(".webp")
        ? "image/webp"
        : "image/gif",
      size: 0,
      type: "gif",
      source: "picker",
    };

    try {
      setIsSending(true);
      setGifPickerOpen(false);
      setEmojiPickerOpen(false);

      await addDoc(collection(db, "messages"), {
        serverId: activeServerId,
        channel: activeChannel,
        user: cleanUsername,
        email: currentUser.email,
        uid: currentUser.uid,
        text: "",
        attachments: [gifAttachment],
        time: getCurrentTime(),
        createdAt: serverTimestamp(),
      });

      setGifSearchText("");
      setGifError("");
    } catch (error) {
      console.error("GIF gönderilemedi:", error);
      alert("GIF gönderilemedi. Firebase/Firestore bağlantısını kontrol et.");
    } finally {
      setIsSending(false);
    }
  }

  function removeGifAttachment(gifId) {
    setGifAttachments((previousGifs) => {
      return previousGifs.filter((gif) => gif.id !== gifId);
    });
  }

  function uploadFileAttachment(file, fileIndex, totalFiles) {
    return new Promise((resolve, reject) => {
      const safeName = sanitizeFileName(file.name);
      const uniqueFileName = `${Date.now()}_${currentUser.uid}_${safeName}`;
      const storagePath = `messageAttachments/${activeServerId}/${activeChannel}/${uniqueFileName}`;
      const fileRef = storageReference(storage, storagePath);
      const uploadTask = uploadBytesResumable(fileRef, file, {
        contentType: file.type || "application/octet-stream",
        customMetadata: {
          serverId: activeServerId,
          channelId: activeChannel,
          uploadedByUid: currentUser.uid,
        },
      });

      uploadTask.on(
        "state_changed",
        (snapshot) => {
          const fileProgress = snapshot.bytesTransferred / snapshot.totalBytes;
          const totalProgress = Math.round(
            ((fileIndex + fileProgress) / totalFiles) * 100
          );
          setUploadProgress(totalProgress);
        },
        (error) => {
          reject(error);
        },
        async () => {
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            resolve({
              name: file.name,
              size: file.size,
              contentType: file.type || "application/octet-stream",
              type: getAttachmentType(file.type, file.name),
              url: downloadURL,
              storagePath,
              source: "upload",
            });
          } catch (error) {
            reject(error);
          }
        }
      );
    });
  }

  async function uploadSelectedFiles() {
    if (selectedFiles.length === 0) {
      return [];
    }

    const uploadedAttachments = [];

    for (const [index, file] of selectedFiles.entries()) {
      const attachment = await uploadFileAttachment(file, index, selectedFiles.length);
      uploadedAttachments.push(attachment);
    }

    return uploadedAttachments;
  }

  async function sendMessage(event) {
    event.preventDefault();

    const cleanText = messageText.trim();
    const cleanUsername = username.trim() || "Guest";
    const hasAttachments = selectedFiles.length > 0 || gifAttachments.length > 0;

    if ((!cleanText && !hasAttachments) || !currentUser || !activeServerId) {
      return;
    }

    try {
      setIsSending(true);
      setUploadProgress(0);

      const uploadedAttachments = await uploadSelectedFiles();
      const attachments = [...uploadedAttachments, ...gifAttachments];

      await addDoc(collection(db, "messages"), {
        serverId: activeServerId,
        channel: activeChannel,
        user: cleanUsername,
        email: currentUser.email,
        uid: currentUser.uid,
        text: cleanText,
        attachments,
        time: getCurrentTime(),
        createdAt: serverTimestamp(),
      });

      setMessageText("");
      setSelectedFiles([]);
      setGifAttachments([]);
      setEmojiPickerOpen(false);
      setGifPickerOpen(false);
      setGifSearchText("");
      setUploadProgress(0);
    } catch (error) {
      console.error("Mesaj gönderilemedi:", error);
      alert("Mesaj veya dosya gönderilemedi. Firebase Storage/Rules ayarlarını kontrol et.");
    } finally {
      setIsSending(false);
    }
  }

  function renderMessageAttachment(attachment, index) {
    const attachmentType = attachment.type || getAttachmentType(
      attachment.contentType,
      attachment.name
    );
    const attachmentName = attachment.name || "Dosya";

    if ((attachmentType === "image" || attachmentType === "gif") && attachment.url) {
      return (
        <a
          className="messageAttachmentPreview"
          href={attachment.url}
          target="_blank"
          rel="noreferrer"
          key={`${attachment.url}_${index}`}
        >
          <img src={attachment.url} alt={attachmentName} loading="lazy" />
          <span>{attachmentType === "gif" ? "GIF" : attachmentName}</span>
        </a>
      );
    }

    if (attachmentType === "video" && attachment.url) {
      return (
        <div className="messageVideoAttachment" key={`${attachment.url}_${index}`}>
          <video src={attachment.url} controls preload="metadata" />
          <a href={attachment.url} target="_blank" rel="noreferrer">
            {attachmentName}
          </a>
        </div>
      );
    }

    return (
      <a
        className="messageFileAttachment"
        href={attachment.url}
        target="_blank"
        rel="noreferrer"
        key={`${attachment.url || attachmentName}_${index}`}
      >
        <span className="messageFileIcon">📎</span>
        <span className="messageFileInfo">
          <strong>{attachmentName}</strong>
          <small>{formatFileSize(attachment.size)}</small>
        </span>
      </a>
    );
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
      alert("Mesaj silinemedi. Kendi mesajını veya sunucu sahibiysen üyelerin mesajlarını silebilirsin.");
    }
  }

  async function kickMemberFromServer(member) {
    if (!isActiveServerOwner || !activeServer || !currentUser || moderationActionLoading) {
      return;
    }

    if (!member?.uid || member.uid === currentUser.uid || member.role === "owner") {
      return;
    }

    const memberName = getMemberName(member);
    const shouldKick = confirm(
      `${memberName} sunucudan atılsın mı? Bu kişi davet koduyla tekrar katılabilir.`
    );

    if (!shouldKick) {
      return;
    }

    try {
      setModerationActionLoading(true);

      const activeParticipantDeletes = voiceChannels.map((voiceChannel) => {
        const roomId = getVoiceRoomId(activeServer.id, voiceChannel.id);
        return deleteDoc(
          doc(db, "voiceRooms", roomId, "participants", member.uid)
        );
      });

      await Promise.allSettled(activeParticipantDeletes);

      await updateDoc(doc(db, "members", getMemberDocumentId(activeServer.id, member.uid)), {
        removed: true,
        kicked: true,
        online: false,
        voiceServerMuted: false,
        voiceServerDeafened: false,
        removedAt: serverTimestamp(),
        removedByUid: currentUser.uid,
        updatedAt: serverTimestamp(),
      });

      await deleteDoc(doc(db, "userServers", member.uid, "servers", activeServer.id));
    } catch (error) {
      console.error("Üye sunucudan atılamadı:", error);
      alert("Üye sunucudan atılamadı. Firestore Rules ayarlarını kontrol et.");
    } finally {
      setModerationActionLoading(false);
    }
  }

  async function kickVoiceParticipant(participant) {
    if (!isActiveServerOwner || !activeServer || !currentUser || moderationActionLoading) {
      return;
    }

    if (!participant?.uid || participant.uid === currentUser.uid) {
      return;
    }

    const participantName = participant.displayName || "Guest";
    const shouldKick = confirm(`${participantName} ses kanalından atılsın mı?`);

    if (!shouldKick) {
      return;
    }

    try {
      setModerationActionLoading(true);
      const roomId = getVoiceRoomId(activeServer.id, participant.channelId);
      await deleteDoc(doc(db, "voiceRooms", roomId, "participants", participant.uid));
    } catch (error) {
      console.error("Kullanıcı sesten atılamadı:", error);
      alert("Kullanıcı sesten atılamadı. Firebase bağlantısını kontrol et.");
    } finally {
      setModerationActionLoading(false);
    }
  }

  async function toggleServerMuteParticipant(participant) {
    if (!isActiveServerOwner || !activeServer || !currentUser || moderationActionLoading) {
      return;
    }

    if (!participant?.uid || participant.uid === currentUser.uid) {
      return;
    }

    const participantName = participant.displayName || "Guest";
    const nextServerMuted = participant.serverMuted !== true;
    const shouldChange = confirm(
      nextServerMuted
        ? `${participantName} sunucu tarafından susturulsun mu? Kullanıcı kendi mikrofonunu açamayacak.`
        : `${participantName} için susturmayı kaldırma izni geri verilsin mi? Mikrofonu otomatik açılmayacak.`
    );

    if (!shouldChange) {
      return;
    }

    try {
      setModerationActionLoading(true);
      const roomId = getVoiceRoomId(activeServer.id, participant.channelId);
      const participantRef = doc(
        db,
        "voiceRooms",
        roomId,
        "participants",
        participant.uid
      );

      const memberRef = doc(
        db,
        "members",
        getMemberDocumentId(activeServer.id, participant.uid)
      );

      if (nextServerMuted) {
        await Promise.all([
          updateDoc(participantRef, {
            serverMuted: true,
            muted: true,
            serverMutedByUid: currentUser.uid,
            serverMutedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          }),
          updateDoc(memberRef, {
            voiceServerMuted: true,
            voiceServerMutedByUid: currentUser.uid,
            voiceServerMutedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          }),
        ]);
        return;
      }

      await Promise.all([
        updateDoc(participantRef, {
          serverMuted: false,
          serverMutedByUid: null,
          serverUnmutedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }),
        updateDoc(memberRef, {
          voiceServerMuted: false,
          voiceServerUnmutedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }),
      ]);
    } catch (error) {
      console.error("Susturma durumu değiştirilemedi:", error);
      alert("Susturma durumu değiştirilemedi. Firebase bağlantısını kontrol et.");
    } finally {
      setModerationActionLoading(false);
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


  function openScreenShareFullscreen(screenShareUid) {
    setFullscreenScreenShareUid(screenShareUid);
    setScreenShareCollapsed(false);
  }

  function closeScreenShareFullscreen() {
    setFullscreenScreenShareUid(null);
  }

  function removeRemoteScreenStream(uid) {
    setRemoteScreenStreams((previousStreams) => {
      return previousStreams.filter((screenStream) => screenStream.uid !== uid);
    });
  }

  function removeRemoteStream(uid) {
    stopAudioLevelMonitor(uid);

    setRemoteStreams((previousStreams) =>
      previousStreams.filter((remoteStream) => remoteStream.uid !== uid)
    );
    removeRemoteScreenStream(uid);
  }

  function addScreenTracksToPeerConnection(remoteUid, peerConnection) {
    if (!screenStreamRef.current || !peerConnection) {
      return [];
    }

    const liveScreenTracks = screenStreamRef.current.getVideoTracks().filter((track) => {
      return track.readyState === "live";
    });

    if (liveScreenTracks.length === 0) {
      return [];
    }

    const existingVideoSenders = peerConnection.getSenders().filter((sender) => {
      return sender.track?.kind === "video";
    });

    if (existingVideoSenders.length > 0) {
      screenSenderMapRef.current.set(remoteUid, existingVideoSenders);
      return existingVideoSenders;
    }

    const screenSenders = liveScreenTracks.map((track) => {
      return peerConnection.addTrack(track, screenStreamRef.current);
    });

    screenSenderMapRef.current.set(remoteUid, screenSenders);
    return screenSenders;
  }

  function removeScreenTracksFromPeerConnection(remoteUid, peerConnection) {
    if (!peerConnection) {
      return;
    }

    const storedScreenSenders = screenSenderMapRef.current.get(remoteUid) || [];
    const videoSenders = peerConnection.getSenders().filter((sender) => {
      return sender.track?.kind === "video";
    });
    const sendersToRemove = Array.from(
      new Set([...storedScreenSenders, ...videoSenders])
    );

    sendersToRemove.forEach((sender) => {
      try {
        peerConnection.removeTrack(sender);
      } catch (error) {
        console.warn("Ekran paylaşımı track'i kaldırılamadı:", error);
      }
    });

    screenSenderMapRef.current.delete(remoteUid);
  }

  async function renegotiatePeerConnection(remoteUid, peerConnection) {
    if (!currentUser || !voiceRoomIdRef.current || !peerConnection) {
      return;
    }

    if (peerConnection.signalingState === "closed") {
      return;
    }

    if (peerConnection.signalingState !== "stable") {
      window.setTimeout(() => {
        const currentPeerConnection = peerConnectionsRef.current.get(remoteUid);

        if (!currentPeerConnection || currentPeerConnection.signalingState !== "stable") {
          return;
        }

        renegotiatePeerConnection(remoteUid, currentPeerConnection).catch((error) => {
          console.warn("Yeniden WebRTC teklifi gönderilemedi:", error);
        });
      }, 450);
      return;
    }

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    await sendVoiceSignal(remoteUid, "offer", {
      type: peerConnection.localDescription.type,
      sdp: peerConnection.localDescription.sdp,
    });
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
    screenSenderMapRef.current.delete(uid);
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

    addScreenTracksToPeerConnection(remoteUid, peerConnection);

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
      const [eventStream] = event.streams;
      const stream = eventStream || new MediaStream([event.track]);

      if (event.track.kind === "video") {
        setRemoteScreenStreams((previousStreams) => {
          const withoutOldStream = previousStreams.filter((screenStream) => {
            return screenStream.uid !== remoteUid;
          });

          return [...withoutOldStream, { uid: remoteUid, stream }];
        });

        event.track.onended = () => {
          removeRemoteScreenStream(remoteUid);
        };

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

                const offerAlreadyRequestedVideo = Boolean(
                  signal.payload?.sdp?.includes("m=video")
                );

                if (screenStreamRef.current && !offerAlreadyRequestedVideo) {
                  window.setTimeout(() => {
                    const currentPeerConnection = peerConnectionsRef.current.get(
                      signal.fromUid
                    );

                    if (!currentPeerConnection) {
                      return;
                    }

                    renegotiatePeerConnection(signal.fromUid, currentPeerConnection).catch(
                      (error) => {
                        console.warn("Ekran paylaşımı teklifi gönderilemedi:", error);
                      }
                    );
                  }, 350);
                }
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

  async function toggleServerDeafenParticipant(participant) {
    if (!isActiveServerOwner || !activeServer || !currentUser || moderationActionLoading) {
      return;
    }

    if (!participant?.uid || participant.uid === currentUser.uid) {
      return;
    }

    const participantName = participant.displayName || "Guest";
    const nextServerDeafened = participant.serverDeafened !== true;
    const shouldChange = confirm(
      nextServerDeafened
        ? `${participantName} sunucu tarafından sağırlaştırılsın mı? Kullanıcı sesi duyamayacak ama mikrofonu otomatik kapanmayacak.`
        : `${participantName} için sağırlaştırmayı kaldırma izni geri verilsin mi?`
    );

    if (!shouldChange) {
      return;
    }

    try {
      setModerationActionLoading(true);
      const roomId = getVoiceRoomId(activeServer.id, participant.channelId);
      const participantRef = doc(
        db,
        "voiceRooms",
        roomId,
        "participants",
        participant.uid
      );

      const memberRef = doc(
        db,
        "members",
        getMemberDocumentId(activeServer.id, participant.uid)
      );

      if (nextServerDeafened) {
        await Promise.all([
          updateDoc(participantRef, {
            serverDeafened: true,
            deafened: true,
            serverDeafenedByUid: currentUser.uid,
            serverDeafenedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          }),
          updateDoc(memberRef, {
            voiceServerDeafened: true,
            voiceServerDeafenedByUid: currentUser.uid,
            voiceServerDeafenedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          }),
        ]);
        return;
      }

      await Promise.all([
        updateDoc(participantRef, {
          serverDeafened: false,
          serverDeafenedByUid: null,
          serverUndeafenedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }),
        updateDoc(memberRef, {
          voiceServerDeafened: false,
          voiceServerUndeafenedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }),
      ]);
    } catch (error) {
      console.error("Sağırlaştırma durumu değiştirilemedi:", error);
      alert("Sağırlaştırma durumu değiştirilemedi. Firebase bağlantısını kontrol et.");
    } finally {
      setModerationActionLoading(false);
    }
  }

  function stopLocalVoiceStream() {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
  }

  async function startScreenShare() {
    if (!voiceJoined || !currentUser || !participantDocRef.current) {
      alert("Ekran paylaşmak için önce bir ses kanalına katılmalısın.");
      return;
    }

    if (screenSharing || screenShareStarting) {
      return;
    }

    if (!navigator.mediaDevices?.getDisplayMedia) {
      setVoiceError("Bu tarayıcı ekran paylaşımını desteklemiyor.");
      return;
    }

    const otherScreenShare = currentVoiceParticipants.find((participant) => {
      return participant.uid !== currentUser.uid && participant.screenSharing;
    });

    if (otherScreenShare) {
      alert(
        `${otherScreenShare.displayName || "Başka bir kullanıcı"} zaten bu kanalda ekran paylaşıyor.`
      );
      return;
    }

    let nextScreenStream = null;

    try {
      setScreenShareStarting(true);
      setVoiceError("");
      setVoiceStatus("Ekran seçimi bekleniyor...");

      nextScreenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: "always",
          displaySurface: "monitor",
        },
        audio: false,
      });

      const [videoTrack] = nextScreenStream.getVideoTracks();

      if (!videoTrack) {
        throw new Error("Ekran video track'i alınamadı.");
      }

      videoTrack.onended = () => {
        stopScreenShare().catch((error) => {
          console.warn("Ekran paylaşımı otomatik durdurulamadı:", error);
        });
      };

      screenStreamRef.current = nextScreenStream;
      setLocalScreenStream(nextScreenStream);
      setScreenSharing(true);
      setScreenShareCollapsed(false);

      await updateDoc(participantDocRef.current, {
        screenSharing: true,
        screenShareStartedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      const renegotiationJobs = [];

      peerConnectionsRef.current.forEach((peerConnection, uid) => {
        addScreenTracksToPeerConnection(uid, peerConnection);
        renegotiationJobs.push(renegotiatePeerConnection(uid, peerConnection));
      });

      await Promise.allSettled(renegotiationJobs);
      setVoiceStatus("Ekran paylaşımı başladı.");
    } catch (error) {
      console.error("Ekran paylaşımı başlatılamadı:", error);

      if (nextScreenStream) {
        nextScreenStream.getTracks().forEach((track) => track.stop());
      }

      screenStreamRef.current = null;
      setLocalScreenStream(null);
      setScreenSharing(false);

      if (participantDocRef.current) {
        updateDoc(participantDocRef.current, {
          screenSharing: false,
          updatedAt: serverTimestamp(),
        }).catch((updateError) => {
          console.warn("Ekran paylaşımı durumu sıfırlanamadı:", updateError);
        });
      }

      if (error.name === "NotAllowedError") {
        setVoiceError("Ekran paylaşımı izni verilmedi veya seçim iptal edildi.");
      } else {
        setVoiceError("Ekran paylaşımı başlatılamadı.");
      }
    } finally {
      setScreenShareStarting(false);
    }
  }

  async function stopScreenShare(updateParticipant = true, renegotiatePeers = true) {
    if (screenShareStopInProgressRef.current) {
      return;
    }

    screenShareStopInProgressRef.current = true;

    try {
      const hadScreenShare = Boolean(screenStreamRef.current || screenSharing);
      const currentScreenStream = screenStreamRef.current;

      screenStreamRef.current = null;

      if (currentScreenStream) {
        currentScreenStream.getTracks().forEach((track) => {
          track.onended = null;
          track.stop();
        });
      }

      setLocalScreenStream(null);
      setScreenSharing(false);
      setScreenShareStarting(false);
      setScreenShareCollapsed(false);

      const renegotiationJobs = [];

      peerConnectionsRef.current.forEach((peerConnection, uid) => {
        removeScreenTracksFromPeerConnection(uid, peerConnection);

        if (renegotiatePeers) {
          renegotiationJobs.push(renegotiatePeerConnection(uid, peerConnection));
        }
      });

      if (updateParticipant && participantDocRef.current) {
        try {
          await updateDoc(participantDocRef.current, {
            screenSharing: false,
              updatedAt: serverTimestamp(),
          });
        } catch (error) {
          console.warn("Ekran paylaşımı durumu güncellenemedi:", error);
        }
      }

      await Promise.allSettled(renegotiationJobs);

      if (hadScreenShare) {
        setVoiceStatus("Ekran paylaşımı durdu.");
      }
    } finally {
      screenShareStopInProgressRef.current = false;
    }
  }

  async function leaveVoiceRoom(updateState = true) {
    if (voiceLeaveInProgressRef.current) {
      return;
    }

    voiceLeaveInProgressRef.current = true;
    const participantRef = participantDocRef.current;

    try {
      voiceJoinedRef.current = false;

      await stopScreenShare(false, false);

    if (signalUnsubscribeRef.current) {
      signalUnsubscribeRef.current();
      signalUnsubscribeRef.current = null;
    }

    peerConnectionsRef.current.forEach((_, uid) => {
      closePeerConnection(uid);
    });

    peerConnectionsRef.current.clear();
    pendingIceCandidatesRef.current.clear();
    screenSenderMapRef.current.clear();
    Array.from(audioMonitorsRef.current.keys()).forEach((uid) => {
      stopAudioLevelMonitor(uid);
    });
    stopLocalVoiceStream();

    participantDocRef.current = null;
    voiceRoomIdRef.current = null;
    voiceChannelIdRef.current = null;

    if (updateState) {
      setVoiceJoined(false);
      setVoiceJoining(false);
      setActiveVoiceChannelId(null);
      setRemoteStreams([]);
      setRemoteScreenStreams([]);
      setLocalScreenStream(null);
      setScreenSharing(false);
      setScreenShareStarting(false);
      setScreenShareCollapsed(false);
      setFullscreenScreenShareUid(null);
      setSpeakingUsers({});
      setVoiceDeafened(false);
      setVoiceServerDeafened(false);
      voiceDeafenedRef.current = false;
      voiceMutedBeforeDeafenRef.current = false;
      setVoiceStatus("Sese katılmadın.");
    }

      if (participantRef) {
        try {
          await deleteDoc(participantRef);
        } catch (error) {
          console.warn("Ses katılımcısı silinemedi:", error);
        }
      }
    } finally {
      voiceServerMutedRef.current = false;
      voiceServerDeafenedRef.current = false;
      voiceLeaveInProgressRef.current = false;

      if (updateState) {
        setVoiceServerMuted(false);
        setVoiceServerDeafened(false);
      }
    }
  }

  async function joinVoiceRoom(voiceChannelId, voiceChannelName) {
    if (!currentUser || !activeServerId || voiceJoining) {
      return;
    }

    const selectedVoiceChannel =
      voiceChannels.find((channel) => channel.id === voiceChannelId) ||
      voiceChannels[0] ||
      DEFAULT_VOICE_CHANNELS[0];

    if (voiceJoined && activeVoiceChannelId === selectedVoiceChannel.id) {
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setVoiceError("Bu tarayıcı mikrofon erişimini desteklemiyor.");
      return;
    }

    if (voiceJoined) {
      await leaveVoiceRoom(true);
    }

    const nextVoiceChannelId = selectedVoiceChannel.id;
    const nextVoiceChannelName = voiceChannelName || selectedVoiceChannel.name;
    const roomId = getVoiceRoomId(activeServerId, nextVoiceChannelId);

    try {
      setVoiceJoining(true);
      setVoiceError("");
      setVoiceStatus("Mikrofon izni bekleniyor...");

      const currentMemberRef = doc(
        db,
        "members",
        getMemberDocumentId(activeServerId, currentUser.uid)
      );
      const currentMemberSnap = await getDoc(currentMemberRef);
      const currentMemberData = currentMemberSnap.exists() ? currentMemberSnap.data() : {};
      const shouldBeServerMuted = currentMemberData.voiceServerMuted === true;
      const shouldBeServerDeafened = currentMemberData.voiceServerDeafened === true;

      voiceDeafenedRef.current = false;
      setVoiceDeafened(false);
      voiceMutedBeforeDeafenRef.current = false;

      if (shouldBeServerMuted) {
        voiceMutedRef.current = true;
        setVoiceMuted(true);
      }

      voiceServerMutedRef.current = shouldBeServerMuted;
      voiceServerDeafenedRef.current = shouldBeServerDeafened;
      setVoiceServerMuted(shouldBeServerMuted);
      setVoiceServerDeafened(shouldBeServerDeafened);

      const localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });

      localStream.getAudioTracks().forEach((track) => {
        track.enabled = !voiceMutedRef.current && !voiceServerMutedRef.current;
      });

      localStreamRef.current = localStream;
      voiceRoomIdRef.current = roomId;
      voiceChannelIdRef.current = nextVoiceChannelId;

      await setDoc(
        doc(db, "voiceRooms", roomId),
        {
          serverId: activeServerId,
          channelId: nextVoiceChannelId,
          name: nextVoiceChannelName,
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
          channelId: nextVoiceChannelId,
          voiceChannelName: nextVoiceChannelName,
          uid: currentUser.uid,
          email: currentUser.email,
          displayName: username.trim() || "Guest",
          muted: voiceMutedRef.current || shouldBeServerMuted,
          serverMuted: shouldBeServerMuted,
          serverMutedByUid: shouldBeServerMuted ? "server" : null,
          deafened: shouldBeServerDeafened,
          serverDeafened: shouldBeServerDeafened,
          serverDeafenedByUid: shouldBeServerDeafened ? "server" : null,
          screenSharing: false,
          joinedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      setupVoiceSignalListener(roomId);

      voiceJoinedRef.current = true;
      setActiveVoiceChannelId(nextVoiceChannelId);
      setVoiceJoined(true);
      setVoiceStatus(`${nextVoiceChannelName} ses kanalına katıldın.`);
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
    if (!voiceJoinedRef.current) {
      setVoiceStatus("Mikrofonu değiştirmek için önce bir ses kanalına katılmalısın.");
      return;
    }

    if (voiceServerMutedRef.current) {
      setVoiceStatus(
        "Sunucu sahibi mikrofonunu kapattı. Açma izni geri verilene kadar mikrofonu açamazsın."
      );
      return;
    }

    const nextMuted = !voiceMutedRef.current;

    applyVoiceMuteState(nextMuted);
    await updateCurrentVoiceParticipant({ muted: nextMuted });
  }

  async function toggleVoiceDeafen() {
    if (!voiceJoinedRef.current) {
      setVoiceStatus("Sağırlaştırmayı kullanmak için önce bir ses kanalına katılmalısın.");
      return;
    }

    if (voiceServerDeafenedRef.current) {
      setVoiceStatus(
        "Sunucu sahibi sesi kapattı. İzin geri verilene kadar sesi açamazsın."
      );
      return;
    }

    const nextDeafened = !voiceDeafenedRef.current;

    if (nextDeafened) {
      voiceMutedBeforeDeafenRef.current = voiceMutedRef.current || voiceServerMutedRef.current;
      applyVoiceDeafenState(true);

      if (!voiceServerMutedRef.current && !voiceMutedRef.current) {
        applyVoiceMuteState(true);
        await updateCurrentVoiceParticipant({ deafened: true, muted: true });
      } else {
        await updateCurrentVoiceParticipant({ deafened: true });
      }

      setVoiceStatus("Sağırlaştırma açıldı.");
      return;
    }

    applyVoiceDeafenState(false);

    if (!voiceMutedBeforeDeafenRef.current && !voiceServerMutedRef.current) {
      applyVoiceMuteState(false);
      await updateCurrentVoiceParticipant({ deafened: false, muted: false });
    } else {
      await updateCurrentVoiceParticipant({ deafened: false });
    }

    voiceMutedBeforeDeafenRef.current = false;
    setVoiceStatus("Sağırlaştırma kapatıldı.");
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
    if (!activeServer) {
      return;
    }

    const activeChannelExists = textChannels.some((channel) => {
      return channel.id === activeChannel;
    });

    if (!activeChannelExists) {
      setActiveChannel(textChannels[0]?.id || "general");
    }
  }, [activeServer, textChannels, activeChannel]);

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
    const intervalId = window.setInterval(() => {
      setPresenceTick(Date.now());
    }, 10000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    if (!currentUser || !activeServer) {
      return;
    }

    let cleanupStarted = false;

    const markOnline = () => {
      if (cleanupStarted) {
        return;
      }

      updateCurrentMemberPresence(true).catch((error) => {
        console.warn("Online durumu güncellenemedi:", error);
      });
    };

    const markOffline = () => {
      cleanupStarted = true;
      updateCurrentMemberPresence(false).catch((error) => {
        console.warn("Offline durumu güncellenemedi:", error);
      });
    };

    markOnline();

    const heartbeatId = window.setInterval(markOnline, PRESENCE_HEARTBEAT_MS);

    window.addEventListener("pagehide", markOffline);
    window.addEventListener("beforeunload", markOffline);

    return () => {
      window.clearInterval(heartbeatId);
      window.removeEventListener("pagehide", markOffline);
      window.removeEventListener("beforeunload", markOffline);
      markOffline();
    };
  }, [currentUser, activeServer?.id, username]);

  useEffect(() => {
    if (!currentUser || !activeServerId) {
      setVoiceParticipants([]);
      return;
    }

    const participantsByChannel = new Map();

    function rebuildVoiceParticipants() {
      const nextParticipants = Array.from(participantsByChannel.values()).flat();

      nextParticipants.sort((a, b) => {
        const aName = a.displayName || a.email || "";
        const bName = b.displayName || b.email || "";
        return aName.localeCompare(bName);
      });

      setVoiceParticipants(nextParticipants);
    }

    const unsubscribers = voiceChannels.map((voiceChannel) => {
      const roomId = getVoiceRoomId(activeServerId, voiceChannel.id);
      const participantsRef = collection(
        db,
        "voiceRooms",
        roomId,
        "participants"
      );

      return onSnapshot(
        participantsRef,
        (snapshot) => {
          const channelParticipants = snapshot.docs.map((participantDoc) => {
            const data = participantDoc.data();

            return {
              id: `${voiceChannel.id}_${participantDoc.id}`,
              ...data,
              serverId: data.serverId || activeServerId,
              channelId: data.channelId || voiceChannel.id,
              voiceChannelName: data.voiceChannelName || voiceChannel.name,
            };
          });

          participantsByChannel.set(voiceChannel.id, channelParticipants);
          rebuildVoiceParticipants();
        },
        (error) => {
          console.error("Ses katılımcıları okunamadı:", error);
          setVoiceError(`Ses katılımcıları okunamadı: ${error.message}`);
        }
      );
    });

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [currentUser, activeServerId, voiceChannelsKey]);

  useEffect(() => {
    if (!voiceJoined || !currentUser || !activeServerId || !localStreamRef.current) {
      return;
    }

    const participantUids = new Set(
      currentVoiceParticipants.map((participant) => participant.uid)
    );

    peerConnectionsRef.current.forEach((_, uid) => {
      if (!participantUids.has(uid)) {
        closePeerConnection(uid);
      }
    });

    currentVoiceParticipants.forEach((participant) => {
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
  }, [voiceJoined, currentVoiceParticipants, currentUser, activeServerId]);

  useEffect(() => {
    if (!voiceJoined || !currentUser || !localStreamRef.current) {
      return;
    }

    startAudioLevelMonitor(currentUser.uid, localStreamRef.current);

    return () => {
      stopAudioLevelMonitor(currentUser.uid);
    };
  }, [voiceJoined, currentUser?.uid]);

  useEffect(() => {
    if (!voiceJoined) {
      return;
    }

    remoteStreams.forEach((remoteStream) => {
      startAudioLevelMonitor(remoteStream.uid, remoteStream.stream);
    });

    return () => {
      remoteStreams.forEach((remoteStream) => {
        stopAudioLevelMonitor(remoteStream.uid);
      });
    };
  }, [voiceJoined, remoteStreams]);

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
    if (!voiceJoined || !currentUser || !participantDocRef.current) {
      return;
    }

    const unsubscribe = onSnapshot(
      participantDocRef.current,
      (snapshot) => {
        if (!snapshot.exists()) {
          if (!voiceLeaveInProgressRef.current && voiceJoinedRef.current) {
            leaveVoiceRoom(true).then(() => {
              setVoiceStatus("Ses kanalından çıkarıldın.");
            });
          }

          return;
        }

        const participantData = snapshot.data();
        const nextServerMuted = participantData.serverMuted === true;
        const nextServerDeafened = participantData.serverDeafened === true;

        voiceServerMutedRef.current = nextServerMuted;
        voiceServerDeafenedRef.current = nextServerDeafened;
        setVoiceServerMuted(nextServerMuted);
        setVoiceServerDeafened(nextServerDeafened);

        if (nextServerMuted) {
          voiceMutedRef.current = true;
          setVoiceMuted(true);
          setLocalMicrophoneEnabled(false);
          setVoiceStatus("Sunucu sahibi mikrofonunu kapattı.");
          return;
        }

        if (nextServerDeafened) {
          setVoiceStatus("Sunucu sahibi sesi kapattı.");
        }

        setLocalMicrophoneEnabled(!voiceMutedRef.current);
      },
      (error) => {
        console.warn("Kendi ses durumu dinlenemedi:", error);
      }
    );

    return () => unsubscribe();
  }, [voiceJoined, currentUser?.uid]);

  useEffect(() => {
    voiceMutedRef.current = voiceMuted;
  }, [voiceMuted]);

  useEffect(() => {
    voiceDeafenedRef.current = voiceDeafened;
  }, [voiceDeafened]);

  useEffect(() => {
    voiceServerDeafenedRef.current = voiceServerDeafened;
  }, [voiceServerDeafened]);

  useEffect(() => {
    if (!voiceJoinedRef.current) {
      return;
    }

    if (!currentUser || !activeServerId || !voiceChannelIdRef.current) {
      leaveVoiceRoom();
      return;
    }

    const voiceChannelStillExists = voiceChannels.some((channel) => {
      return channel.id === voiceChannelIdRef.current;
    });

    if (!voiceChannelStillExists) {
      leaveVoiceRoom();
      return;
    }

    const currentRoomId = getVoiceRoomId(activeServerId, voiceChannelIdRef.current);

    if (voiceRoomIdRef.current && voiceRoomIdRef.current !== currentRoomId) {
      leaveVoiceRoom();
    }
  }, [currentUser, activeServerId, voiceChannelsKey]);

  useEffect(() => {
    return () => {
      leaveVoiceRoom(false);
    };
  }, []);




  useEffect(() => {
    if (!fullscreenScreenShareUid) {
      return;
    }

    const stillAvailable = activeScreenShares.some((screenShare) => {
      return screenShare.uid === fullscreenScreenShareUid && screenShare.stream;
    });

    if (!stillAvailable) {
      setFullscreenScreenShareUid(null);
    }
  }, [activeScreenShares, fullscreenScreenShareUid]);

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

  function renderTextChannel(channel) {
    return (
      <div className="channelRow" key={`text-${channel.id}`}>
        <button
          className={
            activeChannel === channel.id ? "channelButton active" : "channelButton"
          }
          onClick={() => selectTextChannel(channel.id)}
        >
          <span className="channelButtonIcon">#</span>
          <span className="channelButtonLabel">{channel.name}</span>
        </button>

        {isActiveServerOwner && (
          <div className="channelRowActions">
            <button
              className="channelEditButton"
              onClick={() => renameChannel("text", channel.id)}
              disabled={channelActionLoading}
              title="Metin kanalını düzenle"
            >
              ✎
            </button>

            {textChannels.length > 1 && (
              <button
                className="channelDeleteButton"
                onClick={() => deleteChannel("text", channel.id)}
                disabled={channelActionLoading}
                title="Metin kanalını sil"
              >
                ×
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  function renderVoiceChannel(voiceChannel) {
    const channelParticipants = getVoiceParticipantsForChannel(voiceChannel.id);
    const isCurrentVoiceChannel =
      voiceJoined && activeVoiceChannelId === voiceChannel.id;

    return (
      <div
        className={isCurrentVoiceChannel ? "voiceBox active" : "voiceBox"}
        key={`voice-${voiceChannel.id}`}
      >
        <div className="voiceChannelTitle">
          <button
            className={
              isCurrentVoiceChannel
                ? "voiceChannelJoinTarget active"
                : "voiceChannelJoinTarget"
            }
            onClick={() => {
              if (isCurrentVoiceChannel) {
                return;
              }

              joinVoiceRoom(voiceChannel.id, voiceChannel.name);
            }}
            disabled={voiceJoining && !isCurrentVoiceChannel}
            title={
              isCurrentVoiceChannel
                ? "Şu anda bu ses kanalındasın"
                : voiceJoined
                  ? "Bu ses kanalına geç"
                  : "Ses kanalına katıl"
            }
            type="button"
          >
            <span className="voiceChannelIcon">🔊</span>
            <div className="voiceChannelMeta">
              <strong>{voiceChannel.name}</strong>
              <small>{channelParticipants.length} kişi bağlı</small>
            </div>
            <span className="voiceChannelCount">{channelParticipants.length}</span>
          </button>

          {isActiveServerOwner && (
            <div className="voiceChannelManageButtons">
              <button
                className="voiceChannelEditButton"
                onClick={() => renameChannel("voice", voiceChannel.id)}
                disabled={channelActionLoading}
                title="Ses kanalını düzenle"
              >
                ✎
              </button>

              {voiceChannels.length > 1 && (
                <button
                  className="voiceChannelDeleteButton"
                  onClick={() => deleteChannel("voice", voiceChannel.id)}
                  disabled={channelActionLoading}
                  title="Ses kanalını sil"
                >
                  ×
                </button>
              )}
            </div>
          )}
        </div>

        <div className="voiceParticipantList">
          {channelParticipants.length === 0 && (
            <div className="voiceParticipantEmpty">Şu an bu kanalda kimse yok.</div>
          )}

          {channelParticipants.map((participant) => {
            const isCurrentUser = participant.uid === currentUser.uid;
            const effectiveMuted = participant.serverMuted || participant.muted;
            const effectiveDeafened = participant.serverDeafened || participant.deafened;
            const isSpeaking = speakingUsers[participant.uid] && !effectiveMuted;
            const canModerateVoiceParticipant = isActiveServerOwner && !isCurrentUser;
            let participantStatus = "Sessiz";

            if (participant.serverMuted) {
              participantStatus = "Sunucu tarafından susturuldu";
            } else if (participant.serverDeafened) {
              participantStatus = "Sunucu tarafından sağırlaştırıldı";
            } else if (participant.screenSharing && effectiveMuted) {
              participantStatus = "Ekran paylaşıyor · mikrofon kapalı";
            } else if (participant.screenSharing && effectiveDeafened) {
              participantStatus = "Ekran paylaşıyor · sağırlaştırılmış";
            } else if (participant.screenSharing && isSpeaking) {
              participantStatus = "Ekran paylaşıyor · konuşuyor";
            } else if (participant.screenSharing) {
              participantStatus = "Ekran paylaşıyor";
            } else if (effectiveDeafened && effectiveMuted) {
              participantStatus = "Sağırlaştırılmış · mikrofon kapalı";
            } else if (effectiveDeafened) {
              participantStatus = "Sağırlaştırılmış";
            } else if (effectiveMuted) {
              participantStatus = "Mikrofon kapalı";
            } else if (isSpeaking) {
              participantStatus = "Konuşuyor";
            }

            return (
              <div
                className={
                  isSpeaking ? "voiceParticipantItem speaking" : "voiceParticipantItem"
                }
                key={participant.uid}
              >
                <div
                  className={
                    isSpeaking
                      ? "voiceParticipantAvatar speaking"
                      : "voiceParticipantAvatar"
                  }
                >
                  {getUserInitial(participant.displayName)}
                </div>

                <div className="voiceParticipantInfo">
                  <strong>
                    {participant.displayName || "Guest"}
                    {isCurrentUser ? " (sen)" : ""}
                  </strong>
                  <span>{participantStatus}</span>
                </div>

                <span className="voiceParticipantIcon">
                  {participant.serverMuted
                    ? "⛔"
                    : participant.serverDeafened
                      ? "🔕"
                      : participant.screenSharing
                        ? "🖥️"
                        : effectiveDeafened
                          ? "🎧"
                          : effectiveMuted
                            ? "🔇"
                            : isSpeaking
                              ? "🟢"
                              : "🎙️"}
                </span>

                {canModerateVoiceParticipant && (
                  <div className="voiceParticipantModeration">
                    <button
                      className={
                        participant.serverMuted
                          ? "voiceModButton unmute"
                          : "voiceModButton mute"
                      }
                      onClick={() => toggleServerMuteParticipant(participant)}
                      disabled={moderationActionLoading}
                      title={
                        participant.serverMuted
                          ? "Susturmayı kaldırma iznini geri ver"
                          : "Kullanıcıyı sunucu tarafından sustur"
                      }
                    >
                      {participant.serverMuted ? "İzin Ver" : "Sustur"}
                    </button>

                    <button
                      className={
                        participant.serverDeafened
                          ? "voiceModButton undeafen"
                          : "voiceModButton deafen"
                      }
                      onClick={() => toggleServerDeafenParticipant(participant)}
                      disabled={moderationActionLoading}
                      title={
                        participant.serverDeafened
                          ? "Sağırlaştırmayı kaldırma iznini geri ver"
                          : "Kullanıcıyı sunucu tarafından sağırlaştır"
                      }
                    >
                      {participant.serverDeafened ? "Duyur" : "Sağırlaştır"}
                    </button>

                    <button
                      className="voiceModButton kick"
                      onClick={() => kickVoiceParticipant(participant)}
                      disabled={moderationActionLoading}
                      title="Ses kanalından at"
                    >
                      At
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {isCurrentVoiceChannel && voiceJoined && remoteStreams.length > 0 && (
          <div className="voiceRemoteCount">
            {remoteStreams.length} uzak ses bağlantısı aktif.
          </div>
        )}
      </div>
    );
  }

  function renderVoiceControlDock() {
    const activeVoiceChannel = voiceChannels.find((channel) => {
      return channel.id === activeVoiceChannelId;
    });
    const effectiveMuted = voiceServerMuted || voiceMuted;
    const effectiveDeafened = voiceServerDeafened || voiceDeafened;
    const voiceDockStatus = voiceJoined
      ? voiceStatus ||
        (voiceServerDeafened
          ? "Sunucu tarafından sağırlaştırıldın"
          : voiceDeafened
            ? "Sağırlaştırılmış"
            : voiceServerMuted
              ? "Sunucu tarafından susturuldun"
              : effectiveMuted
                ? "Mikrofon kapalı"
                : "Sesli aramada")
      : "Sese katılmadın";

    return (
      <div className={voiceJoined ? "voiceDock connected" : "voiceDock"}>
        {voiceJoined && (
          <div className="voiceDockConnection">
            <span className="voiceDockSignal">≋</span>
            <div>
              <strong>{activeVoiceChannel?.name || "Sesli Sohbet"}</strong>
              <span>{voiceDockStatus}</span>
            </div>
          </div>
        )}

        <div className="voiceDockUserRow">
          <div className="voiceDockUser">
            <div className="voiceDockAvatar">{getUserInitial(username)}</div>
            <div>
              <strong>{username.trim() || "Guest"}</strong>
              <span>{voiceDockStatus}</span>
            </div>
          </div>

          <div className="voiceDockControls">
            <button
              className={
                effectiveMuted
                  ? "voiceDockButton active danger"
                  : "voiceDockButton"
              }
              onClick={toggleVoiceMute}
              disabled={!voiceJoined || voiceServerMuted}
              title={
                !voiceJoined
                  ? "Önce ses kanalına katıl"
                  : voiceServerMuted
                    ? "Sunucu sahibi mikrofonunu kapattı"
                    : effectiveMuted
                      ? "Mikrofonu aç"
                      : "Mikrofonu kapat"
              }
              type="button"
            >
              {voiceServerMuted ? "⛔" : effectiveMuted ? "🔇" : "🎙️"}
            </button>

            <button
              className={
                effectiveDeafened
                  ? "voiceDockButton active"
                  : "voiceDockButton"
              }
              onClick={toggleVoiceDeafen}
              disabled={!voiceJoined || voiceServerDeafened}
              title={
                !voiceJoined
                  ? "Önce ses kanalına katıl"
                  : voiceServerDeafened
                    ? "Sunucu sahibi sesi kapattı"
                    : effectiveDeafened
                      ? "Sağırlaştırmayı kapat"
                      : "Sağırlaştır"
              }
              type="button"
            >
              {voiceServerDeafened ? "🔕" : "🎧"}
            </button>

            {voiceJoined && (
              <button
                className={
                  screenSharing
                    ? "voiceDockButton active screen"
                    : "voiceDockButton screen"
                }
                onClick={() => {
                  if (screenSharing) {
                    stopScreenShare();
                    return;
                  }

                  startScreenShare();
                }}
                disabled={screenShareStarting}
                title={screenSharing ? "Ekran paylaşımını durdur" : "Ekranı paylaş"}
                type="button"
              >
                {screenShareStarting ? "…" : "🖥️"}
              </button>
            )}

            {voiceJoined && (
              <button
                className="voiceDockButton leave"
                onClick={() => leaveVoiceRoom()}
                title="Sesten ayrıl"
                type="button"
              >
                📞
              </button>
            )}
          </div>
        </div>
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
              setServerMenuOpen(false);
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
        <div className="appTitle serverMenuWrap">
          <button
            className="serverTitleButton"
            onClick={() => {
              if (!activeServer) {
                return;
              }

              setServerMenuOpen((previousOpen) => !previousOpen);
            }}
            disabled={!activeServer}
            type="button"
          >
            <div>
              <h1>{activeServer ? activeServer.name : "ZapChat"}</h1>
              <p>{activeServer ? "private lobby" : "sunucu seçilmedi"}</p>
            </div>
            {activeServer && (
              <span className={serverMenuOpen ? "serverTitleChevron open" : "serverTitleChevron"}>
                ⌄
              </span>
            )}
          </button>

          {activeServer && serverMenuOpen && (
            <div className="serverDropdownMenu">
              <button
                className="serverDropdownItem disabled"
                disabled
                type="button"
                title="Bu özellik daha sonra eklenecek"
              >
                <span>⚙️</span>
                <div>
                  <strong>Sunucu Ayarları</strong>
                  <small>Yakında</small>
                </div>
              </button>
            </div>
          )}
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
            {isActiveServerOwner && (
              <div className="channelCategoryToolbar">
                <button
                  className="channelCategoryAddButton"
                  onClick={addChannelCategory}
                  disabled={channelActionLoading}
                  type="button"
                >
                  + Başlık Ekle
                </button>
              </div>
            )}

            {displayedChannelCategories.map((category) => {
              const categoryCollapsed = collapsedCategoryIds[category.id] === true;
              const categoryChannelCount =
                category.textChannels.length + category.voiceChannels.length;

              return (
                <section className="channelCategorySection" key={category.id}>
                  <div className="channelSectionHeader channelSectionHeaderFancy">
                    <button
                      className="channelSectionToggle"
                      onClick={() => toggleChannelCategory(category.id)}
                      type="button"
                    >
                      <span className="channelSectionLine" />
                      <span className="channelSectionTitle">{category.name}</span>
                      <span className="channelSectionLine" />
                      <span className="channelSectionChevron">
                        {categoryCollapsed ? "›" : "⌄"}
                      </span>
                    </button>

                    {isActiveServerOwner && (
                      <div className="channelCategoryActions">
                        <div className="channelCreateMenuWrap">
                          <button
                            className="channelCategoryIconButton"
                            onClick={() => toggleChannelCreateMenu(category.id)}
                            disabled={channelActionLoading}
                            title="Bu başlığa kanal ekle"
                            type="button"
                          >
                            +
                          </button>

                          {openChannelCreateMenuId === category.id && (
                            <div className="channelCreateMenu">
                              <button
                                className="channelCreateMenuButton"
                                onClick={() => handleChannelCreateMenuAction("text", category.id)}
                                type="button"
                              >
                                <span>#</span>
                                Metin kanalı ekle
                              </button>
                              <button
                                className="channelCreateMenuButton"
                                onClick={() => handleChannelCreateMenuAction("voice", category.id)}
                                type="button"
                              >
                                <span>🔊</span>
                                Ses kanalı ekle
                              </button>
                            </div>
                          )}
                        </div>
                        <button
                          className="channelCategoryIconButton"
                          onClick={() => renameChannelCategory(category.id)}
                          disabled={channelActionLoading}
                          title="Başlığı düzenle"
                          type="button"
                        >
                          ✎
                        </button>
                        {channelCategories.length > 1 && (
                          <button
                            className="channelCategoryIconButton danger"
                            onClick={() => deleteChannelCategory(category.id)}
                            disabled={channelActionLoading}
                            title="Başlığı sil"
                            type="button"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {!categoryCollapsed && (
                    <div className="channelCategoryBody">
                      {category.textChannels.length > 0 && (
                        <div className="channels">
                          {category.textChannels.map((channel) => {
                            return renderTextChannel(channel);
                          })}
                        </div>
                      )}

                      {category.voiceChannels.length > 0 && (
                        <div className="voiceChannelList">
                          {category.voiceChannels.map((voiceChannel) => {
                            return renderVoiceChannel(voiceChannel);
                          })}
                        </div>
                      )}

                      {categoryChannelCount === 0 && (
                        <div className="channelCategoryEmpty">
                          Bu başlıkta henüz kanal yok.
                        </div>
                      )}
                    </div>
                  )}
                </section>
              );
            })}

            {voiceError && <div className="voiceErrorText">{voiceError}</div>}
          </>
        ) : (
          <div className="sidebarHint">
            Bir sunucuya katılın ya da sunucu oluşturun.
          </div>
        )}

        {renderVoiceControlDock()}
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

        {activeServer && voiceJoined && activeScreenShares.length > 0 && (
          <section
            className={
              screenShareCollapsed
                ? "screenSharePanel collapsed"
                : "screenSharePanel"
            }
          >
            <div className="screenSharePanelHeader">
              <div>
                <span>Ekran Paylaşımı</span>
                <strong>
                  {activeScreenShares.length === 1
                    ? `${activeScreenShares[0].displayName || "Guest"} ekran paylaşıyor`
                    : `${activeScreenShares.length} ekran paylaşımı var`}
                </strong>
              </div>

              <div className="screenSharePanelActions">
                <button
                  className="screenShareToggleButton"
                  onClick={() => setScreenShareCollapsed((isCollapsed) => !isCollapsed)}
                >
                  {screenShareCollapsed ? "Genişlet" : "Küçült"}
                </button>

                {screenSharing && (
                  <button
                    className="screenShareStopButton"
                    onClick={() => stopScreenShare()}
                  >
                    Paylaşımı Durdur
                  </button>
                )}
              </div>
            </div>

            {screenShareCollapsed ? (
              <div className="screenShareCollapsedInfo">
                Ekran paylaşımı arka planda açık. Kanalları ve mesajları kullanmaya devam edebilirsin.
              </div>
            ) : (
              <div className="screenShareGrid">
                {activeScreenShares.map((screenShare) => (
                  <div className="screenShareCard" key={screenShare.uid}>
                    <div className="screenShareCardTop">
                      <strong>
                        {screenShare.displayName || "Guest"}
                        {screenShare.isLocalShare ? " (sen)" : ""}
                      </strong>
                      <div className="screenShareCardActions">
                        <span>Canlı</span>
                        {screenShare.stream && (
                          <button
                            className="screenShareFullscreenButton"
                            onClick={() => openScreenShareFullscreen(screenShare.uid)}
                          >
                            Tam Ekran
                          </button>
                        )}
                      </div>
                    </div>

                    {screenShare.stream ? (
                      <ScreenShareViewerBox
                        screenShare={screenShare}
                        muted={screenShare.isLocalShare}
                      />
                    ) : (
                      <div className="screenShareLoading">
                        Ekran bağlantısı bekleniyor...
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {activeServer && !voiceJoined && activeScreenShares.length > 0 && (
          <section className="screenShareHint">
            Bir ekran paylaşımı var. İzlemek için ilgili ses kanalına katılmalısın.
          </section>
        )}

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
                const canDeleteMessage = isOwnMessage || isActiveServerOwner;

                return (
                  <div className="message" key={message.id}>
                    <div className="avatar">
                      {(message.user || "G").charAt(0).toUpperCase()}
                    </div>

                    <div className="messageContent">
                      <div className="messageMeta">
                        <strong>{message.user}</strong>
                        <span>{message.time}</span>

                        {canDeleteMessage && (
                          <button
                            className="deleteButton"
                            onClick={() => deleteMessage(message.id)}
                          >
                            Sil
                          </button>
                        )}
                      </div>

                      {message.text && <p>{message.text}</p>}

                      {getMessageAttachments(message).length > 0 && (
                        <div className="messageAttachments">
                          {getMessageAttachments(message).map((attachment, index) => {
                            return renderMessageAttachment(attachment, index);
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              <div ref={messagesEndRef} />
            </section>

            <form className="messageForm" onSubmit={sendMessage}>
              <input
                ref={fileInputRef}
                className="hiddenFileInput"
                type="file"
                multiple
                accept="image/*,video/*,.pdf,.zip,.rar,.7z,.txt,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                onChange={handleFileSelection}
              />

              {(selectedFiles.length > 0 || gifAttachments.length > 0 || isSending) && (
                <div className="attachmentComposerPanel">
                  {selectedFiles.map((file, index) => (
                    <div className="attachmentChip" key={`${file.name}_${file.size}_${index}`}>
                      <span>{getAttachmentType(file.type, file.name) === "video" ? "🎬" : getAttachmentType(file.type, file.name) === "file" ? "📎" : "🖼️"}</span>
                      <div>
                        <strong>{file.name}</strong>
                        <small>{formatFileSize(file.size)}</small>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeSelectedFile(index)}
                        disabled={isSending}
                      >
                        ×
                      </button>
                    </div>
                  ))}

                  {gifAttachments.map((gif) => (
                    <div className="attachmentChip" key={gif.id}>
                      <span>GIF</span>
                      <div>
                        <strong>GIF bağlantısı</strong>
                        <small>{gif.url}</small>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeGifAttachment(gif.id)}
                        disabled={isSending}
                      >
                        ×
                      </button>
                    </div>
                  ))}

                  {isSending && uploadProgress > 0 && (
                    <div className="uploadProgressText">
                      Yükleniyor: %{uploadProgress}
                    </div>
                  )}
                </div>
              )}

              <div className="messageInputRow">
                <button
                  className="messageToolButton"
                  type="button"
                  onClick={openFilePicker}
                  disabled={isSending}
                  title={`Dosya, resim veya video ekle. Tek dosya limiti: ${MAX_UPLOAD_SIZE_LABEL}`}
                >
                  +
                </button>

                <input
                  value={messageText}
                  onChange={(event) => setMessageText(event.target.value)}
                  placeholder={`#${activeChannelName} kanalına mesaj gönder`}
                />

                <div className="messageTools">
                  <button
                    className="messageToolButton"
                    type="button"
                    onClick={toggleEmojiPicker}
                    disabled={isSending}
                    title="Emoji ekle"
                  >
                    😊
                  </button>
                  <button
                    className="messageToolButton"
                    type="button"
                    onClick={toggleGifPicker}
                    disabled={isSending}
                    title="GIF seç"
                  >
                    GIF
                  </button>
                </div>

                <button className="messageSendButton" type="submit" disabled={isSending}>
                  {isSending ? "..." : "Gönder"}
                </button>
              </div>

              {emojiPickerOpen && (
                <div className="emojiPicker">
                  <div className="emojiPickerHeader">
                    <div>
                      <strong>Emoji seç</strong>
                      <span>{emojiDataLoading ? "Emoji listesi yükleniyor" : "Standart emoji kategorileri"}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEmojiPickerOpen(false)}
                      title="Kapat"
                    >
                      ×
                    </button>
                  </div>

                  <div className="emojiPickerSearchWrap">
                    <input
                      className="emojiPickerSearch"
                      value={emojiSearchText}
                      onChange={(event) => setEmojiSearchText(event.target.value)}
                      placeholder="Emoji ara: smile, heart, food, flag..."
                    />
                    {emojiSearchText && (
                      <button
                        className="emojiPickerClearButton"
                        type="button"
                        onClick={() => setEmojiSearchText("")}
                        title="Aramayı temizle"
                      >
                        ×
                      </button>
                    )}
                  </div>

                  <div className="emojiPickerBody">
                    <aside className="emojiCategoryRail">
                      {emojiCategoriesForPicker.map((category) => (
                        <button
                          className={
                            activeEmojiCategory.id === category.id && !emojiSearchText
                              ? "emojiCategoryButton active"
                              : "emojiCategoryButton"
                          }
                          type="button"
                          key={category.id}
                          onClick={() => selectEmojiCategory(category.id)}
                          title={category.label}
                        >
                          {category.icon}
                        </button>
                      ))}
                    </aside>

                    <div className="emojiPickerContent">
                      {displayedEmojiGroups.length === 0 ? (
                        <div className="emojiPickerEmpty">
                          Bu arama için emoji bulunamadı.
                        </div>
                      ) : (
                        displayedEmojiGroups.map((category) => (
                          <section className="emojiGroup" key={category.id}>
                            <div className="emojiGroupTitle">{category.label}</div>
                            <div className="emojiGrid">
                              {category.emojis.map((emojiItem, emojiIndex) => (
                                <button
                                  type="button"
                                  key={`${category.id}-${emojiItem.emoji}-${emojiIndex}`}
                                  onClick={() => addEmojiToMessage(emojiItem)}
                                  onMouseEnter={() => setHoveredEmojiName(`:${emojiItem.shortcode}:`)}
                                  title={`${emojiItem.emoji} :${emojiItem.shortcode}:`}
                                >
                                  <EmojiGlyph emoji={emojiItem.emoji} />
                                </button>
                              ))}
                            </div>
                          </section>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="emojiPickerFooter">
                    <span>
                      {hoveredEmojiName ||
                        (emojiSearchText
                          ? "Arama sonuçları"
                          : emojiDataError || activeEmojiCategory?.label)}
                    </span>
                  </div>
                </div>
              )}

              {gifPickerOpen && (
                <div className="gifPicker">
                  <div className="gifPickerHeader">
                    <div>
                      <strong>GIF seç</strong>
                      <span>
                        {hasExternalGifProvider()
                          ? `${GIF_PROVIDER === "tenor" ? "Tenor" : "GIPHY"} üzerinden ara`
                          : "Hazır GIF havuzu"}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setGifPickerOpen(false)}
                      title="Kapat"
                    >
                      ×
                    </button>
                  </div>

                  <div className="gifPickerSearchWrap">
                    <input
                      className="gifPickerSearch"
                      value={gifSearchText}
                      onChange={(event) => {
                        setGifActiveCategory("search");
                        setGifSearchText(event.target.value);
                      }}
                      placeholder="GIF ara: hello, lol, cat..."
                    />
                    {gifSearchText && (
                      <button
                        className="gifPickerClearButton"
                        type="button"
                        onClick={() => {
                          setGifSearchText("");
                          setGifActiveCategory("popular");
                        }}
                        title="Aramayı temizle"
                      >
                        ×
                      </button>
                    )}
                  </div>

                  <div className="gifCategoryStrip">
                    {GIF_CATEGORIES.map((category) => (
                      <button
                        className={
                          gifActiveCategory === category.id
                            ? "gifCategoryPill active"
                            : "gifCategoryPill"
                        }
                        type="button"
                        key={category.id}
                        onClick={() => selectGifCategory(category)}
                      >
                        {category.title}
                      </button>
                    ))}
                  </div>

                  {gifError && <div className="gifPickerNotice">{gifError}</div>}

                  <div className="gifPickerGrid">
                    {gifLoading && <div className="gifPickerEmpty">GIF'ler yükleniyor...</div>}

                    {!gifLoading && gifResults.length > 0 &&
                      gifResults.map((gif) => (
                        <button
                          className="gifPickerCard"
                          type="button"
                          key={gif.id}
                          onClick={() => sendGifFromPicker(gif)}
                          title={`${gif.title} GIF gönder`}
                        >
                          <img
                            src={gif.previewUrl || gif.url}
                            alt={gif.title}
                            loading="lazy"
                          />
                        </button>
                      ))}

                    {!gifLoading && gifResults.length === 0 && (
                      <div className="gifPickerEmpty">
                        Bu aramaya uygun GIF bulunamadı.
                      </div>
                    )}
                  </div>
                </div>
              )}
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
            <span title="Çevrimiçi / toplam üye">{onlineMemberCount}/{activeMemberCount}</span>
          </div>

          <div className="memberList">
            {memberError && <div className="memberEmpty">{memberError}</div>}

            {!memberError && activeMemberCount === 0 && (
              <div className="memberEmpty">Henüz üye bilgisi yok.</div>
            )}

            {!memberError && activeMemberCount > 0 && (
              <>
                <section className="memberGroup">
                  <div className="memberGroupTitle">Çevrim içi — {onlineMemberCount}</div>
                  <div className="memberGroupItems">
                    {onlineMembers.length > 0 ? (
                      onlineMembers.map((member) => renderMemberItem(member))
                    ) : (
                      <div className="memberEmpty compact">Çevrimiçi üye yok.</div>
                    )}
                  </div>
                </section>

                <section className="memberGroup">
                  <div className="memberGroupTitle">Çevrim dışı — {offlineMemberCount}</div>
                  <div className="memberGroupItems">
                    {offlineMembers.length > 0 ? (
                      offlineMembers.map((member) => renderMemberItem(member))
                    ) : (
                      <div className="memberEmpty compact">Çevrimdışı üye yok.</div>
                    )}
                  </div>
                </section>
              </>
            )}
          </div>
        </aside>
      )}

      {fullscreenScreenShare && fullscreenScreenShare.stream && (
        <div className="screenFullscreenOverlay">
          <div className="screenFullscreenHeader">
            <div>
              <span>Tam ekran izleme</span>
              <strong>
                {fullscreenScreenShare.displayName || "Guest"} ekran paylaşıyor
              </strong>
            </div>

            <div className="screenFullscreenActions">
              <button onClick={closeScreenShareFullscreen}>Kapat</button>
            </div>
          </div>

          <ScreenShareViewerBox
            screenShare={fullscreenScreenShare}
            muted={fullscreenScreenShare.isLocalShare}
            fullscreen
          />
        </div>
      )}

      <div className="remoteAudioMount" aria-hidden="true">
        {remoteStreams.map((remoteStream) => (
          <RemoteAudio
            key={remoteStream.uid}
            stream={remoteStream.stream}
            muted={voiceDeafened || voiceServerDeafened}
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