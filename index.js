if (!document.querySelector('script[src*="iconify-icon"]')) {
    let script = document.createElement('script');
    script.src = 'https://code.iconify.design/iconify-icon/2.1.0/iconify-icon.min.js';
    document.head.appendChild(script);
}

const PLUGIN_VERSION = "1.0.3";

window.historyPluginActionToken = 0;
function getNewActionToken() {
    window.historyPluginActionToken = Date.now();
    return window.historyPluginActionToken;
}
function isCurrentAction(token) {
    return window.historyPluginActionToken === token;
}

function tsGetContext() {
    try { return SillyTavern.getContext(); } catch(e) { return null; }
}

function tsHeaders() {
    let ctx = tsGetContext();
    if (ctx && typeof ctx.getRequestHeaders === "function") {
        let h = ctx.getRequestHeaders();
        if (h && !h["Content-Type"]) h["Content-Type"] = "application/json";
        return h;
    }
    return { "Content-Type": "application/json" };
}

function getExtFolderName() {
    return localStorage.getItem('tavernStickyExtName') || "Gooseee";
}

function saveExtFolderName(v) {
    localStorage.setItem('tavernStickyExtName', v);
}

function getTranslateConfig() {
    const defaults = { provider: "google", lang: "zh-CN", deeplApiKey: "" };
    return Object.assign(defaults, JSON.parse(localStorage.getItem('tavernStickyTranslate') || '{}'));
}
function saveTranslateConfig(v) { localStorage.setItem('tavernStickyTranslate', JSON.stringify(v)); }

function getHistoryIcons() {
    const defaults = { search: "", top: "", latest: "", bottom: "", opening: "", translate: "" };
    return Object.assign(defaults, JSON.parse(localStorage.getItem('historySearchIcons') || '{}'));
}
function saveHistoryIcons(v) { localStorage.setItem('historySearchIcons', JSON.stringify(v)); }

function getHistoryToasts() {
    const defaults = {
        jump: "叮咚！您预订的楼层已送达，请签收 📦",
        loadMore: "爬楼爬到腿软了...拜托点下顶部的「Show more messages」拉我一把 🧗",
        exportDone: "打包完毕！勾中的楼层已装箱发货，注意查收 🚚",
        transEmpty: "输入框空空如也，没啥可翻译的呀 🤷",
        transNoPlugin: "未找到酒馆原生翻译插件，请确保已启用 ⚠️",
        transDoing: "正在施展翻译魔法... 🪄",
        transError: "翻译出错，请检查控制台报错 ❌"
    };
    return Object.assign(defaults, JSON.parse(localStorage.getItem('historySearchToasts') || '{}'));
}
function saveHistoryToasts(v) { localStorage.setItem('historySearchToasts', JSON.stringify(v)); }

function showHistoryToast(text) {
    if (!text || text.trim() === "") return;
    let container = document.querySelector("#history-toast-container");
    if (!container) {
        container = document.createElement("div");
        container.id = "history-toast-container";
        document.body.appendChild(container);
    }
    let toast = document.createElement("div");
    toast.className = "history-toast-item";
    toast.innerHTML = `<iconify-icon icon="lucide:sparkles" class="toast-sparkle"></iconify-icon><span>${text}</span>`;
    container.appendChild(toast);

    setTimeout(() => { toast.classList.add("show"); }, 10);
    setTimeout(() => {
        toast.classList.remove("show");
        setTimeout(() => toast.remove(), 300);
    }, 2400);
}

function renderIconContent(val, defaultIconify) {
    if (!val || val.trim() === "") return `<iconify-icon icon="${defaultIconify}"></iconify-icon>`;
    let trimmed = val.trim();
    if (trimmed.startsWith("http") || trimmed.startsWith("data:") || trimmed.match(/\.(png|jpg|jpeg|webp|svg|gif)$/i)) {
        return `<img src="${trimmed}" style="width:100%;height:100%;object-fit:cover;border-radius:6px;display:block;">`;
    }
    return `<iconify-icon icon="${trimmed}"></iconify-icon>`;
}

function applyHistoryIcons() {
    let icons = getHistoryIcons();
    const setIcon = (id, url, defaultIconify) => {
        let btn = document.querySelector(id);
        if (btn) btn.innerHTML = renderIconContent(url, defaultIconify);
    };
    setIcon("#history-search-main", icons.search, "lucide:search");
    setIcon("#history-top", icons.top, "lucide:arrow-up-to-line");
    setIcon("#history-latest-top", icons.latest, "lucide:chevrons-up");
    setIcon("#history-bottom", icons.bottom, "lucide:arrow-down-to-line");
    setIcon("#history-opening", icons.opening, "lucide:clapperboard");
    setIcon("#history-translate", icons.translate, "lucide:languages");
}

function tsParseDate(raw) {
    if (raw === undefined || raw === null || raw === "") return null;
    if (typeof raw === "number") {
        let d = new Date(raw);
        return isNaN(d.getTime()) ? null : d;
    }
    let str = String(raw).trim();
    if (/^\d+$/.test(str)) {
        let d = new Date(Number(str));
        return isNaN(d.getTime()) ? null : d;
    }
    let m = str.match(/(\d{4})-(\d{1,2})-(\d{1,2})[\s@]*(\d{1,2})h\s*(\d{1,2})m\s*(\d{1,2})s/);
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6]));
    let m2 = str.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m2) return new Date(Number(m2[1]), Number(m2[2]) - 1, Number(m2[3]));
    let d2 = new Date(str);
    return isNaN(d2.getTime()) ? null : d2;
}

function getAcquaintInfo() {
    let ctx = tsGetContext();
    if (!ctx) return null;
    let name = "对方";
    let charDate = null;
    try {
        let ch = ctx.characters[ctx.characterId];
        if (ch) {
            name = ch.name || name;
            charDate = tsParseDate(ch.create_date) || tsParseDate(ch.date_added) || tsParseDate(ch.json_data && JSON.parse(ch.json_data).create_date);
        }
    } catch(e) {}
    let chatDate = null;
    try {
        if (ctx.chat && ctx.chat.length > 0) chatDate = tsParseDate(ctx.chat[0].send_date);
        if (!name || name === "对方") {
            let firstAi = ctx.chat.find(m => !m.is_user);
            if (firstAi && firstAi.name) name = firstAi.name;
        }
    } catch(e) {}
    let start = charDate || chatDate;
    if (!start) return { name: name, ok: false };
    let today = new Date();
    let a = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    let b = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    let days = Math.floor((b - a) / 86400000) + 1;
    let week = ["日", "一", "二", "三", "四", "五", "六"][start.getDay()];
    return {
        ok: true,
        name: name,
        days: days < 1 ? 1 : days,
        dateText: `${start.getFullYear()}年${start.getMonth() + 1}月${start.getDate()}日 星期${week}`,
        timeText: `${String(start.getHours()).padStart(2, "0")}:${String(start.getMinutes()).padStart(2, "0")}`,
        firstChat: chatDate ? `${chatDate.getFullYear()}年${chatDate.getMonth() + 1}月${chatDate.getDate()}日` : null
    };
}

function toggleAcquaintInfo() {
    let box = document.querySelector("#ts-know-info");
    if (!box) return;
    if (box.classList.contains("open")) {
        box.classList.remove("open");
        box.innerHTML = "";
        return;
    }
    let info = getAcquaintInfo();
    if (!info || !info.ok) {
        box.innerHTML = `<div class="ts-know-line">还没能查到你们的初遇时间，先去聊两句吧 🌙</div>`;
    } else {
        box.innerHTML = `
            <div class="ts-know-line"><iconify-icon icon="lucide:heart-handshake"></iconify-icon> 与 <b>${escapeHtml(info.name)}</b> 相识第 <b>${info.days}</b> 天</div>
            <div class="ts-know-line"><iconify-icon icon="lucide:calendar-days"></iconify-icon> 初遇于 ${info.dateText} ${info.timeText}</div>
            ${info.firstChat ? `<div class="ts-know-line"><iconify-icon icon="lucide:message-circle"></iconify-icon> 本段聊天始于 ${info.firstChat}</div>` : ``}
        `;
    }
    box.classList.add("open");
}

async function fetchExtVersion() {
    let name = getExtFolderName();
    for (let g of [false, true]) {
        try {
            let res = await fetch('/api/extensions/version', {
                method: 'POST',
                headers: tsHeaders(),
                body: JSON.stringify({ extensionName: name, global: g })
            });
            if (res.ok) {
                let data = await res.json();
                if (data) { data._global = g; return data; }
            }
        } catch(e) {}
    }
    return null;
}

async function runUpdateCheck(auto) {
    let btn = document.querySelector("#ts-update-btn");
    if (!btn) return;
    btn.disabled = true;
    btn.innerText = "检查中...";
    let data = await fetchExtVersion();
    btn.disabled = false;
    if (!data) {
        btn.innerText = "重新检查";
        btn.classList.remove("ts-update-available");
        return;
    }
    if (data.isUpToDate === false) {
        btn.innerText = "立即更新";
        btn.classList.add("ts-update-available");
    } else {
        btn.innerText = "已是最新";
        btn.classList.remove("ts-update-available");
    }
}

async function doExtUpdate() {
    let btn = document.querySelector("#ts-update-btn");
    if (!btn) return;
    btn.disabled = true;
    btn.innerText = "更新中...";
    let name = getExtFolderName();
    let ok = false;
    for (let g of [false, true]) {
        try {
            let res = await fetch('/api/extensions/update', {
                method: 'POST',
                headers: tsHeaders(),
                body: JSON.stringify({ extensionName: name, global: g })
            });
            if (res.ok) { ok = true; break; }
        } catch(e) {}
    }
    btn.disabled = false;
    if (ok) {
        btn.classList.remove("ts-update-available");
        btn.innerText = "已更新";
        setTimeout(() => { location.reload(); }, 1000);
    } else {
        btn.innerText = "重新检查";
    }
}

function getSwipeInfo() {
    let ctx;
    try { ctx = SillyTavern.getContext(); } catch(e) { return null; }
    let chat = ctx.chat;
    if (!chat || chat.length === 0) return null;

    let targetId = chat.length - 1;
    while (targetId >= 0) {
        if (chat[targetId].swipes && chat[targetId].swipes.length > 1) {
            break;
        }
        targetId--;
    }
    if (targetId < 0) {
        if (chat[0]) {
            let alt = 0;
            try {
                let ch = ctx.characters[ctx.characterId];
                alt = ch && ch.data && ch.data.alternate_greetings ? ch.data.alternate_greetings.length : 0;
            } catch(e) {}
            return { msg: chat[0], count: Math.max(1, alt + 1), current: chat[0].swipe_id || 0, id: 0 };
        }
        return null;
    }

    let msg = chat[targetId];
    return { msg: msg, count: msg.swipes.length, current: msg.swipe_id || 0, id: targetId };
}

async function switchOpening(targetIndex) {
    let info = getSwipeInfo();
    if (!info) return;
    if (targetIndex < 0 || targetIndex >= info.count) return;

    let token = getNewActionToken();
    let mesDom = document.querySelector(`.mes[mesid="${info.id}"]`);
    if (!mesDom) return;

    let guard = 0;
    while (guard < 300) {
        if (!isCurrentAction(token)) return;
        let cur = SillyTavern.getContext().chat[info.id].swipe_id || 0;
        if (cur === targetIndex) break;
        let btn = cur < targetIndex ? mesDom.querySelector('.swipe_right') : mesDom.querySelector('.swipe_left');
        if (!btn) break;
        btn.click();
        guard++;
        await new Promise(r => setTimeout(r, 120));
    }
}

function openOpeningPanel() {
    let old = document.querySelector("#opening-jump-panel");
    if (old) { old.remove(); return; }
    let info = getSwipeInfo();
    if (!info) return;
    let panel = document.createElement("div");
    panel.id = "opening-jump-panel";
    let items = "";
    for (let i = 0; i < info.count; i++) {
        items += `<button class="opening-num-btn ${i === info.current ? 'active' : ''}" data-idx="${i}">${i + 1}</button>`;
    }
    panel.innerHTML = `
        <div class="opening-panel-header">
            <span><iconify-icon icon="lucide:clapperboard" class="title-icon"></iconify-icon> 楼层回复跳转 (#${info.id}楼)</span>
            <button id="opening-close" title="关闭面板">×</button>
        </div>
        <div class="opening-num-grid">${items}</div>
    `;
    document.body.appendChild(panel);
    panel.querySelector("#opening-close").onclick = () => panel.remove();
    panel.querySelectorAll(".opening-num-btn").forEach(b => {
        b.onclick = async () => {
            panel.remove();
            await switchOpening(Number(b.dataset.idx));
        };
    });
}

function addHistoryButtons() {
    if(document.querySelector("#history-tools")) return;
    const sendForm = document.querySelector("#send_form");
    if(!sendForm) return;

    let box = document.createElement("div");
    box.id = "history-tools";
    box.innerHTML = `
        <button id="history-search-main" title="Tavern Sticky"></button>
        <button id="history-top" title="回聊天整体顶部"></button>
        <button id="history-latest-top" title="回最新楼层顶部"></button>
        <button id="history-bottom" title="回聊天最底部"></button>
        <button id="history-opening" title="楼层回复跳转"></button>
        <button id="history-translate" title="翻译输入框内容"></button>
    `;
    sendForm.appendChild(box);
    applyHistoryIcons();

    document.querySelector("#history-search-main").onclick = () => {
        getNewActionToken();
        openHistoryPanel();
    };

    document.querySelector("#history-top").onclick = () => { executeJump(0, null, true); };

    document.querySelector("#history-latest-top").onclick = () => {
        let token = getNewActionToken();
        let chatArr = SillyTavern.getContext().chat;
        if (!chatArr || chatArr.length === 0) return;
        let lastId = chatArr.length - 1;
        let target = document.querySelector('.mes[mesid="' + lastId + '"]');
        let chat = document.querySelector("#chat");
        if (target && chat) {
            chat.scrollTop = target.offsetTop;
            setTimeout(() => { if (isCurrentAction(token)) target.scrollIntoView({ behavior: "smooth", block: "start" }); }, 150);
        } else if (chat) {
            chat.scrollTop = chat.scrollHeight;
        }
    };

    document.querySelector("#history-bottom").onclick = () => {
        let chat = document.querySelector("#chat");
        if(chat) { chat.scrollTop = chat.scrollHeight; }
    };

    let openingClickTimer = null;
    document.querySelector("#history-opening").onclick = () => {
        if (openingClickTimer) {
            clearTimeout(openingClickTimer);
            openingClickTimer = null;
            let p = document.querySelector("#opening-jump-panel");
            if (p) p.remove();
            switchOpening(0);
        } else {
            openingClickTimer = setTimeout(() => {
                openingClickTimer = null;
                openOpeningPanel();
            }, 260);
        }
    };

    document.querySelector("#history-translate").onclick = async () => {
        let textarea = document.querySelector("#send_textarea");
        let toasts = getHistoryToasts();
        if (!textarea || !textarea.value.trim()) {
            showHistoryToast(toasts.transEmpty);
            return;
        }

        let config = getTranslateConfig();
        let originalText = textarea.value;

        if (config.provider !== 'deepl' && typeof window.translate !== "function") {
            showHistoryToast(toasts.transNoPlugin);
            return;
        }

        showHistoryToast(toasts.transDoing);
        try {
            let res = "";

            if (config.provider === 'deepl' && config.deeplApiKey) {
                let isFreeApi = config.deeplApiKey.endsWith(':fx');
                let baseApiUrl = isFreeApi ? 'https://api-free.deepl.com/v2/translate' : 'https://api.deepl.com/v2/translate';

                let apiUrl = 'https://corsproxy.io/?' + encodeURIComponent(baseApiUrl);

                let targetLang = config.lang.toUpperCase();
                if (targetLang.startsWith('ZH')) targetLang = 'ZH';
                if (targetLang === 'EN') targetLang = 'EN-US';

                let response = await fetch(apiUrl, {
                    method: 'POST',
                    headers: {
                        'Authorization': 'DeepL-Auth-Key ' + config.deeplApiKey,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        text: [originalText],
                        target_lang: targetLang
                    })
                });

                if (response.ok) {
                    let data = await response.json();
                    if (data.translations && data.translations.length > 0) {
                        res = data.translations[0].text;
                    }
                } else {
                    throw new Error("DeepL API Request Failed: " + response.status);
                }
            } else {
                res = await window.translate(originalText, config.lang, config.provider);
            }

            if (res) {
                textarea.value = res;
                textarea.dispatchEvent(new Event('input', { bubbles: true }));
            } else {
            }
        } catch (e) {
            console.error(e);
            showHistoryToast(toasts.transError);
        }
    };
}

setInterval(() => { addHistoryButtons(); }, 2000);

function getHistoryScale() { return JSON.parse(localStorage.getItem('historySearchScale') || '{"size":1,"font":1}'); }
function saveHistoryScale(v) { localStorage.setItem('historySearchScale', JSON.stringify(v)); }
function applyHistoryScale(panel) {
    let s = getHistoryScale();
    panel.style.setProperty('--hs-scale', s.size);
    panel.style.fontSize = 'calc(16px * ' + s.font + ')';
}

function openHistoryPanel() {
    let old = document.querySelector("#history-search-panel");
    if(old) { old.remove(); return; }

    let total = 0;
    try { total = SillyTavern.getContext().chat.length; } catch(e) {}

    let panel = document.createElement("div");
    panel.id = "history-search-panel";

    panel.innerHTML = `
        <div class="history-header">
            <span class="history-title-wrap">
                <iconify-icon icon="lucide:book-heart" class="title-icon" id="ts-know-icon" title="查看相识天数"></iconify-icon>
                <span class="history-title-main">Tavern Sticky</span>
                <span class="history-version">v${PLUGIN_VERSION}</span>
                <button id="ts-update-btn" class="hs-update-btn">检查更新</button>
                <span id="history-ui-setting" title="插件UI及图标设置"><iconify-icon icon="lucide:settings"></iconify-icon></span>
            </span>
            <button id="history-close" title="关闭"><iconify-icon icon="lucide:x"></iconify-icon></button>
        </div>
        <div id="ts-know-info"></div>
        <div class="history-total">当前聊天共 <strong>${total}</strong> 条消息 (楼层范围: 0 ~ ${total > 0 ? total - 1 : 0})</div>

        <div class="history-input-box">
            <input id="history-jump-input" type="number" placeholder="输入指定楼层 (如: 15)">
            <button id="history-jump-btn" class="hs-btn hs-btn-secondary">空降</button>
        </div>

        <div class="history-input-box">
            <input id="history-keyword" placeholder="输入关键词 (支持按回车搜索)">
            <button id="history-search-start" class="hs-btn hs-btn-primary">搜索</button>
            <button id="history-show-all" class="hs-btn hs-btn-secondary">全楼层</button>
        </div>
        <div id="history-result">等待搜索...</div>
    `;

    document.body.appendChild(panel);
    applyHistoryScale(panel);

    document.querySelector("#ts-know-icon").onclick = () => { toggleAcquaintInfo(); };

    document.querySelector("#ts-update-btn").onclick = () => {
        let btn = document.querySelector("#ts-update-btn");
        if (btn.classList.contains("ts-update-available")) doExtUpdate();
        else runUpdateCheck(false);
    };
    runUpdateCheck(true);

    let setting = document.querySelector("#history-ui-setting");
    setting.onclick = () => {
        let menu = document.querySelector("#history-scale-menu");
        if(menu) { menu.remove(); return; }

        let s = getHistoryScale();
        let icons = getHistoryIcons();
        let toasts = getHistoryToasts();
        let tCfg = getTranslateConfig();

        const fullLangs = { 'af':'Afrikaans','sq':'Albanian','am':'Amharic','ar':'Arabic','hy':'Armenian','az':'Azerbaijani','eu':'Basque','be':'Belarusian','bn':'Bengali','bs':'Bosnian','bg':'Bulgarian','ca':'Catalan','ceb':'Cebuano','zh-CN':'Chinese (Simplified)','zh-TW':'Chinese (Traditional)','co':'Corsican','hr':'Croatian','cs':'Czech','da':'Danish','nl':'Dutch','en':'English','eo':'Esperanto','et':'Estonian','fi':'Finnish','fr':'French','fy':'Frisian','gl':'Galician','ka':'Georgian','de':'German','el':'Greek','gu':'Gujarati','ht':'Haitian Creole','ha':'Hausa','haw':'Hawaiian','iw':'Hebrew','hi':'Hindi','hmn':'Hmong','hu':'Hungarian','is':'Icelandic','ig':'Igbo','id':'Indonesian','ga':'Irish','it':'Italian','ja':'Japanese','jw':'Javanese','kn':'Kannada','kk':'Kazakh','km':'Khmer','ko':'Korean','ku':'Kurdish','ky':'Kyrgyz','lo':'Lao','la':'Latin','lv':'Latvian','lt':'Lithuanian','lb':'Luxembourgish','mk':'Macedonian','mg':'Malagasy','ms':'Malay','ml':'Malayalam','mt':'Maltese','mi':'Maori','mr':'Marathi','mn':'Mongolian','my':'Myanmar (Burmese)','ne':'Nepali','no':'Norwegian','ny':'Nyanja (Chichewa)','ps':'Pashto','fa':'Persian','pl':'Polish','pt-PT':'Portuguese (Portugal)','pt-BR':'Portuguese (Brazil)','pa':'Punjabi','ro':'Romanian','ru':'Russian','sm':'Samoan','gd':'Scots Gaelic','sr':'Serbian','st':'Sesotho','sn':'Shona','sd':'Sindhi','si':'Sinhala (Sinhalese)','sk':'Slovak','sl':'Slovenian','so':'Somali','es':'Spanish','su':'Sundanese','sw':'Swahili','sv':'Swedish','tl':'Tagalog (Filipino)','tg':'Tajik','ta':'Tamil','te':'Telugu','th':'Thai','tr':'Turkish','uk':'Ukrainian','ur':'Urdu','uz':'Uzbek','vi':'Vietnamese','cy':'Welsh','xh':'Xhosa','yi':'Yiddish','yo':'Yoruba','zu':'Zulu' };
        let langOptions = Object.keys(fullLangs).map(k => `<option value="${k}" ${tCfg.lang === k ? 'selected' : ''}>${fullLangs[k]}</option>`).join("");

        let providerOptions = `
            <option value="google" ${tCfg.provider === 'google' ? 'selected' : ''}>Google</option>
            <option value="libre" ${tCfg.provider === 'libre' ? 'selected' : ''}>LibreTranslate</option>
            <option value="lingva" ${tCfg.provider === 'lingva' ? 'selected' : ''}>Lingva</option>
            <option value="deepl" ${tCfg.provider === 'deepl' ? 'selected' : ''}>DeepL API</option>
            <option value="deeplx" ${tCfg.provider === 'deeplx' ? 'selected' : ''}>DeepLX</option>
            <option value="bing" ${tCfg.provider === 'bing' ? 'selected' : ''}>Bing</option>
            <option value="oneringtranslator" ${tCfg.provider === 'oneringtranslator' ? 'selected' : ''}>OneRingTranslator</option>
            <option value="yandex" ${tCfg.provider === 'yandex' ? 'selected' : ''}>Yandex</option>
        `;

        menu = document.createElement("div");
        menu.id = "history-scale-menu";
        menu.innerHTML = `
            <div class="scale-slider-item"><label>窗口缩放: </label><input type="range" id="slider-size" min="0.7" max="1.8" step="0.05" value="${s.size}"><span id="val-size">${s.size}</span></div>
            <div class="scale-slider-item"><label>字体大小: </label><input type="range" id="slider-font" min="0.7" max="1.8" step="0.05" value="${s.font}"><span id="val-font">${s.font}</span></div>
            <hr class="hs-divider">
            <div class="setting-subtitle">翻译设置 (调用酒馆原生插件或直连DeepL)</div>
            <div class="scale-slider-item">
                <label>提供商:</label>
                <select id="ts-translate-provider" style="flex: 1; border-radius: 6px; background: rgba(255,255,255,0.06); color: inherit; border: 1px solid rgba(255,255,255,0.1); padding: 5px;">${providerOptions}</select>
            </div>
            <div class="scale-slider-item">
                <label>目标语言:</label>
                <select id="ts-translate-lang" style="flex: 1; border-radius: 6px; background: rgba(255,255,255,0.06); color: inherit; border: 1px solid rgba(255,255,255,0.1); padding: 5px;">${langOptions}</select>
            </div>
            <div class="scale-slider-item">
                <label>DeepL Key:</label>
                <input type="text" id="ts-translate-deepl-key" placeholder="仅在使用DeepL时生效" value="${tCfg.deeplApiKey || ''}">
            </div>
            <hr class="hs-divider">
            <div class="setting-subtitle">更新设置 (扩展文件夹名，用于在线更新)</div>
            <div class="scale-slider-item">
                <label>目录名:</label>
                <input type="text" id="update-name-input" placeholder="Gooseee" value="${getExtFolderName()}">
            </div>
            <hr class="hs-divider"><div class="setting-subtitle">自定义按键图标</div>
            <div class="scale-slider-item"><label>搜索:</label><input type="text" id="icon-input-search" placeholder="如 lucide:search" value="${icons.search}"></div>
            <div class="scale-slider-item"><label>总顶:</label><input type="text" id="icon-input-top" placeholder="如 lucide:arrow-up-to-line" value="${icons.top}"></div>
            <div class="scale-slider-item"><label>新顶:</label><input type="text" id="icon-input-latest" placeholder="如 lucide:chevrons-up" value="${icons.latest}"></div>
            <div class="scale-slider-item"><label>底部:</label><input type="text" id="icon-input-bottom" placeholder="如 lucide:arrow-down-to-line" value="${icons.bottom}"></div>
            <div class="scale-slider-item"><label>开场:</label><input type="text" id="icon-input-opening" placeholder="如 lucide:clapperboard" value="${icons.opening}"></div>
            <div class="scale-slider-item"><label>翻译:</label><input type="text" id="icon-input-translate" placeholder="如 lucide:languages" value="${icons.translate}"></div>
            <hr class="hs-divider"><div class="setting-subtitle">弹窗文案 (留空则隐藏)</div>
            <div class="scale-slider-item"><label>空降:</label><input type="text" id="toast-input-jump" placeholder="到达楼层时的提示文案" value="${toasts.jump}"></div>
            <div class="scale-slider-item"><label>爬楼:</label><input type="text" id="toast-input-loadMore" placeholder="加载历史信息时的提示文案" value="${toasts.loadMore}"></div>
            <div class="scale-slider-item"><label>导出成功:</label><input type="text" id="toast-input-exportDone" placeholder="导出成功时的提示文案" value="${toasts.exportDone}"></div>
            <div class="scale-slider-item"><label>翻译空框:</label><input type="text" id="toast-input-transEmpty" placeholder="输入框为空时的提示" value="${toasts.transEmpty}"></div>
            <div class="scale-slider-item"><label>无翻译插件:</label><input type="text" id="toast-input-transNoPlugin" placeholder="未找到原生翻译插件时的提示" value="${toasts.transNoPlugin}"></div>
            <div class="scale-slider-item"><label>翻译中:</label><input type="text" id="toast-input-transDoing" placeholder="正在翻译时的提示" value="${toasts.transDoing}"></div>
            <div class="scale-slider-item"><label>翻译报错:</label><input type="text" id="toast-input-transError" placeholder="翻译出错时的提示" value="${toasts.transError}"></div>
            <button id="save-icons-btn" class="hs-btn hs-btn-accent">保存所有设置并生效</button>
        `;
        panel.insertBefore(menu, panel.children[2]);

        menu.querySelector("#slider-size").oninput = (e) => { let x = getHistoryScale(); x.size = Number(e.target.value); menu.querySelector("#val-size").textContent = x.size.toFixed(2); saveHistoryScale(x); applyHistoryScale(panel); };
        menu.querySelector("#slider-font").oninput = (e) => { let x = getHistoryScale(); x.font = Number(e.target.value); menu.querySelector("#val-font").textContent = x.font.toFixed(2); saveHistoryScale(x); applyHistoryScale(panel); };

        document.querySelector("#save-icons-btn").onclick = () => {
            saveExtFolderName(document.querySelector("#update-name-input").value.trim() || "Gooseee");
            saveTranslateConfig({
                provider: document.querySelector("#ts-translate-provider").value,
                lang: document.querySelector("#ts-translate-lang").value,
                deeplApiKey: document.querySelector("#ts-translate-deepl-key").value.trim()
            });
            saveHistoryIcons({ search: document.querySelector("#icon-input-search").value, top: document.querySelector("#icon-input-top").value, latest: document.querySelector("#icon-input-latest").value, bottom: document.querySelector("#icon-input-bottom").value, opening: document.querySelector("#icon-input-opening").value, translate: document.querySelector("#icon-input-translate").value });
            saveHistoryToasts({
                jump: document.querySelector("#toast-input-jump").value,
                loadMore: document.querySelector("#toast-input-loadMore").value,
                exportDone: document.querySelector("#toast-input-exportDone").value,
                transEmpty: document.querySelector("#toast-input-transEmpty").value,
                transNoPlugin: document.querySelector("#toast-input-transNoPlugin").value,
                transDoing: document.querySelector("#toast-input-transDoing").value,
                transError: document.querySelector("#toast-input-transError").value
            });
            applyHistoryIcons();
            document.querySelector("#save-icons-btn").innerText = "已保存! 马上生效✨";
            setTimeout(() => { document.querySelector("#save-icons-btn").innerText = "保存所有设置并生效"; }, 1500);
        };
    };

    document.querySelector("#history-close").onclick = () => { panel.remove(); };

    document.querySelector("#history-search-start").onclick = () => {
        document.querySelector("#history-keyword").blur();
        setTimeout(() => searchHistory(), 150);
    };

    document.querySelector("#history-show-all").onclick = () => {
        document.querySelector("#history-keyword").blur();
        setTimeout(() => showAllFloors(), 150);
    };

    document.querySelector("#history-keyword").addEventListener("keydown", function(e) {
        if (e.key === "Enter") { e.preventDefault(); this.blur(); setTimeout(() => searchHistory(), 150); }
    });

    document.querySelector("#history-jump-btn").onclick = () => {
        let input = document.querySelector("#history-jump-input");
        input.blur();
        if(input.value !== "") { getNewActionToken(); setTimeout(() => executeJump(Number(input.value)), 150); }
    };

    document.querySelector("#history-jump-input").addEventListener("keydown", function(e) {
        if (e.key === "Enter") {
            e.preventDefault(); this.blur();
            if(this.value !== "") { getNewActionToken(); setTimeout(() => executeJump(Number(this.value)), 150); }
        }
    });
}

function escapeHtml(str) { return String(str).replace(/&/g,"&").replace(/</g,"<").replace(/>/g,">"); }
function escapeReg(str) { return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
function highlightText(text, key) {
    let safe = escapeHtml(text);
    let reg = new RegExp(escapeReg(key), "gi");
    return safe.replace(reg, "<mark>$&</mark>");
}

function bindResultItemEvents(chat) {
    document.querySelectorAll(".history-copy").forEach((btn) => {
        btn.onclick = (e) => {
            e.stopPropagation();
            let id = Number(btn.closest(".history-item").dataset.id);
            if(chat[id]) {
                navigator.clipboard.writeText(chat[id].mes || "");
                btn.innerText = "已复制";
                setTimeout(() => { btn.innerText = "复制全文"; }, 1500);
            }
        };
    });

    document.querySelectorAll(".history-item").forEach(item => {
        item.onclick = () => { getNewActionToken(); executeJump(item.dataset.id, item); };
    });
}

function showAllFloors() {
    let result = document.querySelector("#history-result");
    let chat = SillyTavern.getContext().chat;
    if (!chat || chat.length === 0) {
        result.innerHTML = `<div class="hs-empty-tip">当前聊天没有任何消息</div>`;
        return;
    }

    let chars = [...new Set(chat.map(m => m.name || "未知"))];
    let charOptions = chars.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");

    result.innerHTML = `
        <div class="history-count">
            <span>共 <b>${chat.length}</b> 条消息</span>
            <span class="history-select-actions">
                <select id="floor-char-filter" class="hs-select">
                    <option value="">--仅勾选角色--</option>
                    ${charOptions}
                </select>
                <label class="hs-check-all"><input type="checkbox" id="floor-check-all"> 全选</label>
                <button id="floor-export-btn" class="hs-btn hs-btn-secondary hs-btn-mini">导出勾选</button>
            </span>
        </div>
    ` + chat.map((msg, index) => {
        return `
            <div class="history-item" data-id="${index}">
                <div class="history-item-header">
                    <span class="floor-check-wrap">
                        <input type="checkbox" class="floor-check" data-id="${index}" data-name="${escapeHtml(msg.name || '未知')}">
                        <span class="history-number"># ${index} 楼</span>
                    </span>
                    <span class="history-name">${escapeHtml(msg.name || "未知")}</span>
                </div>
                <div class="history-message">${escapeHtml(msg.mes || "")}</div>
                <div class="history-item-footer">
                    <button class="history-copy">复制全文</button>
                </div>
            </div>
        `;
    }).join("");

    document.querySelectorAll(".floor-check").forEach(cb => { cb.onclick = (e) => { e.stopPropagation(); }; });

    document.querySelector("#floor-check-all").onclick = (e) => {
        e.stopPropagation();
        let checked = e.target.checked;
        document.querySelectorAll(".floor-check").forEach(cb => { cb.checked = checked; });
        document.querySelector("#floor-char-filter").value = "";
    };

    document.querySelector("#floor-char-filter").onchange = (e) => {
        let selectedChar = e.target.value;
        if (!selectedChar) return;
        document.querySelector("#floor-check-all").checked = false;
        document.querySelectorAll(".floor-check").forEach(cb => {
            cb.checked = (cb.dataset.name === selectedChar);
        });
    };

    document.querySelector("#floor-export-btn").onclick = (e) => {
        e.stopPropagation();
        let selected = [];
        document.querySelectorAll(".floor-check:checked").forEach(cb => {
            let id = Number(cb.dataset.id);
            if (chat[id]) selected.push({ index: id, name: chat[id].name || "未知", text: chat[id].mes || "" });
        });
        if (selected.length === 0) {
            alert("宝宝，一层楼都没勾，导出个寂寞呀！先勾选几层再点我~");
            return;
        }
        let content = selected.map(i => `# ${i.index} 楼 [${i.name}]\n${i.text}`).join("\n\n--------------------------------\n\n");
        let a = document.createElement("a");
        a.href = URL.createObjectURL(new Blob(["\ufeff" + content], { type: "text/plain;charset=utf-8" }));
        a.download = `楼层导出_共${selected.length}层.txt`;
        document.body.appendChild(a); a.click(); a.remove();
        showHistoryToast(getHistoryToasts().exportDone);
    };
    bindResultItemEvents(chat);
}

async function executeJump(id, visualItem = null, isTop = false) {
    let token = getNewActionToken();
    let total = 0;
    try { total = SillyTavern.getContext().chat.length; } catch(e) {}
    if (id < 0 || id >= total) { alert(`宝宝，楼层错啦！当前只有 0 到 ${total > 0 ? total - 1 : 0} 楼。`); return; }

    let chatDOM = document.querySelector("#chat");
    if (!chatDOM) return;
    let target = document.querySelector(`.mes[mesid="${id}"]`);
    let currentFirstMesNode = document.querySelector('.mes');
    let lastFirstMesId = currentFirstMesNode ? currentFirstMesNode.getAttribute('mesid') : null;
    let promptCount = 0; let lastPromptTime = Date.now();

    if (!target && visualItem) visualItem.style.opacity = "0.5";
    while (!target) {
        if (!isCurrentAction(token)) { if (visualItem) visualItem.style.opacity = "1"; return; }
        chatDOM.scrollTop = 0;
        let topBtn = document.querySelector("#top-msgs-btn");
        if (topBtn && topBtn.style.display !== "none") topBtn.click();

        let now = Date.now();
        currentFirstMesNode = document.querySelector('.mes');
        let currentFirstMesId = currentFirstMesNode ? currentFirstMesNode.getAttribute('mesid') : null;

        if (now - lastPromptTime >= 5000) {
            if (currentFirstMesId === lastFirstMesId) {
                promptCount++;
                if (promptCount > 3) { if (visualItem) visualItem.style.opacity = "1"; return; }
                else { showHistoryToast(getHistoryToasts().loadMore); }
            } else { promptCount = 0; lastFirstMesId = currentFirstMesId; }
            lastPromptTime = now;
        } else if (currentFirstMesId !== lastFirstMesId) {
            promptCount = 0; lastFirstMesId = currentFirstMesId; lastPromptTime = now;
        }
        await new Promise(r => setTimeout(r, 200));
        target = document.querySelector(`.mes[mesid="${id}"]`);
    }

    if (!isCurrentAction(token)) return;
    if (visualItem) visualItem.style.opacity = "1";
    if (target) {
        chatDOM.scrollTop = target.offsetTop;
        setTimeout(() => {
            if (!isCurrentAction(token)) return;
            chatDOM.scrollTop = target.offsetTop;
            target.scrollIntoView({ behavior: "smooth", block: "start" });
            target.style.transition = "outline 0.3s ease";
            target.style.outline = "3px solid var(--SmartThemeQuoteColor, #ff9800)";
            target.style.outlineOffset = "2px";
            target.style.borderRadius = "8px";
            setTimeout(() => { target.style.outline = "transparent"; }, 2500);
            if (!isTop) showHistoryToast(getHistoryToasts().jump);
        }, 150);
    }
}

function searchHistory() {
    let input = document.querySelector("#history-keyword");
    let key = input.value.trim();
    let result = document.querySelector("#history-result");
    if(!key) { result.innerHTML = `<div class="hs-empty-tip">请输入要搜索的关键词</div>`; return; }

    let chat = SillyTavern.getContext().chat;
    let found = [];
    chat.forEach((msg, index) => {
        let text = msg.mes || "";
        if(text.toLowerCase().includes(key.toLowerCase())) found.push({ index: index, name: msg.name || "未知", text: text });
    });

    if(found.length === 0) {
        result.innerHTML = `<div class="hs-empty-tip">没有找到与“<strong>${escapeHtml(key)}</strong>”匹配的消息</div>`;
        return;
    }
    result.innerHTML = `<div class="history-count"><span>找到 <b>${found.length}</b> 条相关消息</span></div>` + found.map((item) => {
        return `<div class="history-item" data-id="${item.index}">
                    <div class="history-item-header"><span class="history-number"># ${item.index} 楼</span><span class="history-name">${escapeHtml(item.name)}</span></div>
                    <div class="history-message">${highlightText(item.text, key)}</div>
                    <div class="history-item-footer"><button class="history-copy">复制全文</button></div>
                </div>`;
    }).join("");
    bindResultItemEvents(chat);
}
