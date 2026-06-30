const view = document.querySelector("#view");
const navButtons = [...document.querySelectorAll("[data-tab]")];

function setActive(tab) {
  navButtons.forEach((button) => button.classList.toggle("active", button.dataset.tab === tab));
}

function chip(text, tone = "") {
  return `<span class="chip ${tone}">${text}</span>`;
}

function miniAvatar(name = "") {
  return `<div class="mini-avatar">${name.slice(0, 1)}</div>`;
}

function storyRail() {
  const users = [
    ["晚风", "96%"],
    ["清风", "木旺"],
    ["星河", "语音"],
    ["云深", "附近"],
    ["山海", "深聊"],
  ];
  return `<div class="story-rail">${users.map(([name, tag]) => `<div class="story-bubble">${miniAvatar(name)}<b>${name}</b><span>${tag}</span></div>`).join("")}</div>`;
}

function baziMiniGrid() {
  const items = [
    ["戊", "阳土", "earth"],
    ["丁", "阴火", "fire"],
    ["甲", "阳木", "wood main"],
    ["辛", "阴金", "metal"],
    ["寅", "阳木", "wood"],
    ["巳", "阴火", "fire"],
    ["子", "阳水", "water"],
    ["未", "阴土", "earth"],
  ];
  return `<div class="bazi-mini-grid">${items.map(([big, small, cls]) => `<div class="bazi-token ${cls}"><b>${big}</b><span>${small}</span></div>`).join("")}</div>`;
}

function renderHome() {
  view.className = "mobile-stage";
  view.innerHTML = `
    <section class="phone-screen">
      <header class="mobile-top">
        <div><p>今日同频</p><h1>FATE</h1></div>
        <div class="top-avatar"></div>
      </header>

      <section class="hero-social-card">
        <div>
          <span class="soft-pill">八字人格画像已更新</span>
          <h2>用八字，找到真正聊得来的人</h2>
          <p>你是「灵感表达型」，适合被认真回应，也更容易和冷静倾听型用户进入深聊。</p>
          <button class="primary-btn">开始同频匹配</button>
        </div>
        <div class="match-orb">96%</div>
      </section>

      ${storyRail()}

      <section class="card clean-card">
        <div class="section-head"><h3>我的八字标签</h3><span>完整画像</span></div>
        ${baziMiniGrid()}
        <div class="tag-cloud">
          ${chip("思维活跃", "goldish")} ${chip("表达力旺盛")} ${chip("外热内敏", "pink")} ${chip("适合语音破冰")} ${chip("最受木系欢迎", "green")}
        </div>
      </section>

      <section class="card rec-card">
        <div class="section-head"><h3>今晚推荐</h3><span>3 个新契合</span></div>
        <div class="match-list">
          ${[
            ["晚风与你", "金水型倾听者", "适合从文字慢聊开始", "94%"],
            ["清风徐来", "木系共鸣者", "附近 1.2km，想散步", "91%"],
          ].map(([name, tag, desc, score]) => `<div class="person-row">${miniAvatar(name)}<div><b>${name}</b><p>${tag} · ${desc}</p></div><strong>${score}</strong></div>`).join("")}
        </div>
      </section>
    </section>
  `;
}

function renderSquare() {
  view.className = "mobile-stage";
  view.innerHTML = `
    <section class="phone-screen">
      <header class="mobile-top">
        <div><p>同频广场</p><h1>看看大家在想什么</h1></div>
        <button class="round-btn">＋</button>
      </header>
      <div class="topic-tabs">
        <button class="active">推荐</button><button>情绪</button><button>成长</button><button>恋爱</button><button>玄学</button>
      </div>
      <section class="compose-card">
        ${miniAvatar("我")}<span>分享一个此刻的情绪或巧合...</span><button>发布</button>
      </section>
      ${[
        ["晚风与你", "外冷内热", "最近总感觉很累，明明什么都没做，却提不起劲。有没有同频的人聊聊？", "263", "187"],
        ["山海之间", "行动力强", "30 岁才明白，人生不是逆袭，而是选择。允许一切发生，也允许自己慢慢来。", "312", "241"],
        ["清风徐来", "松弛生活家", "今天被一句话治愈：所有的好运，都是日积月累的善良。", "198", "133"],
      ].map(([name, tag, text, like, comment]) => `<article class="feed-card">
        <div class="feed-head">${miniAvatar(name)}<div><b>${name}</b><p>${tag} · 2 小时前</p></div><button>关注</button></div>
        <p class="feed-text">${text}</p>
        <div class="tag-cloud">${chip("想找同频")} ${chip("适合深聊", "pink")} ${chip("关系人格")}</div>
        <div class="feed-actions"><span>❤ ${like}</span><span>💬 ${comment}</span><span>☆ 收藏</span></div>
      </article>`).join("")}
    </section>
  `;
}

function renderCoordinates() {
  view.className = "mobile-stage";
  view.innerHTML = `
    <section class="phone-screen">
      <header class="mobile-top">
        <div><p>命运坐标</p><h1>附近适合你的场景</h1></div>
        <button class="round-btn">⌕</button>
      </header>
      <section class="map-preview-card">
        <div class="map-grid">
          <span class="route r1"></span><span class="route r2"></span><span class="route r3"></span>
          <span class="pin p1">92</span><span class="pin p2">咖啡</span><span class="pin p3">展览</span>
          <div class="map-tip">三里屯太古里<br><b>92% 匹配你</b></div>
        </div>
      </section>
      <section class="card">
        <div class="section-head"><h3>推荐给你的地点</h3><span>基于标签</span></div>
        ${[
          ["月木咖啡", "适合慢热深聊", "金水型用户复聊率更高", "92%"],
          ["晚风展览", "适合灵感表达", "今晚 18 个同频打卡", "89%"],
          ["城市散步线", "适合安静陪伴", "附近 7 人开放聊天", "86%"],
        ].map(([name, tag, desc, score]) => `<div class="place-row"><div><b>${name}</b><p>${tag} · ${desc}</p></div><strong>${score}</strong></div>`).join("")}
      </section>
    </section>
  `;
}

function renderMessages() {
  view.className = "mobile-stage";
  view.innerHTML = `
    <section class="phone-screen">
      <header class="mobile-top">
        <div><p>消息</p><h1>正在聊的人</h1></div>
        <button class="round-btn">⌕</button>
      </header>
      <div class="topic-tabs"><button class="active">全部</button><button>同频</button><button>系统</button><button>看过我</button></div>
      ${[
        ["晚风与你", "刚看了你的帖子，真的很有共鸣。", "金水型", "2"],
        ["清风徐来", "你们对命运的理解好深刻，想多交流。", "木旺", "1"],
        ["星河漫游", "你的观点很独特，方便聊聊吗？", "火旺", ""],
        ["FATE 小助手", "你的本周关系画像已生成。", "官方", ""],
      ].map(([name, msg, tag, unread]) => `<div class="message-card">${miniAvatar(name)}<div><b>${name} ${chip(tag)}</b><p>${msg}</p></div>${unread ? `<span class="badge">${unread}</span>` : `<span class="time">刚刚</span>`}</div>`).join("")}
    </section>
  `;
}

function renderProfile() {
  view.className = "mobile-stage";
  view.innerHTML = `
    <section class="phone-screen">
      <header class="profile-hero-mobile">
        <div class="profile-face"></div>
        <h1>晚风与你</h1>
        <p>FATE ID 286728 · 灵感表达型</p>
        <div class="tag-cloud">${chip("思维活跃", "goldish")} ${chip("外冷内热")} ${chip("适合深聊", "pink")} ${chip("INTJ")}</div>
      </header>
      <section class="profile-stats-card">
        <div><b>88</b><span>能量</span></div>
        <div><b>1268</b><span>获赞</span></div>
        <div><b>342</b><span>评论</span></div>
        <div><b>93%</b><span>契合</span></div>
      </section>
      <section class="card clean-card">
        <div class="section-head"><h3>核心关系画像</h3><span>会员解锁更多</span></div>
        <p class="profile-copy">你是典型的灵感表达型：思维活跃、表达力旺盛，但也需要被认真理解。你更容易和稳定倾听型用户建立持续关系。</p>
        <div class="tag-cloud">${chip("最受木系欢迎", "green")} ${chip("适合金水型倾听者", "blue")} ${chip("夜聊型", "pink")}</div>
      </section>
    </section>
  `;
}

const renderers = {
  home: renderHome,
  square: renderSquare,
  coordinates: renderCoordinates,
  messages: renderMessages,
  profile: renderProfile,
};

function switchTab(tab) {
  setActive(tab);
  renderers[tab]();
}

navButtons.forEach((button) => button.addEventListener("click", () => switchTab(button.dataset.tab)));
switchTab("home");
