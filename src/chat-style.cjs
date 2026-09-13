// Presentation only: Discord keeps ownership of messages, editor state and events.
// Match semantic attributes and CSS-module prefixes, never a particular hash.
const CHAT = ':root:has([class*="chatContent_"], [data-list-id="chat-messages"])';
const MESSAGE = '[data-list-item-id^="chat-messages___"]';
const APP = `${CHAT} [class*="base_"]:has([class*="sidebar_"]):has([class*="page_"])`;

function chatCSS({ navigation = false } = {}) {
  return `
    ${CHAT} {
      --font-primary: "JetBrainsMono Nerd Font", "JetBrains Mono", monospace !important;
      --font-display: "JetBrainsMono Nerd Font", "JetBrains Mono", monospace !important;
      --font-headline: "JetBrainsMono Nerd Font", "JetBrains Mono", monospace !important;
      --font-code: "JetBrainsMono Nerd Font", "JetBrains Mono", monospace !important;
      --custom-channel-textarea-text-area-height: 48px !important;
      --custom-chat-input-margin-bottom: 0px !important;
      --chat-markup-line-height: 21px !important;
      --background-gradient-chat: none !important;
      --background-gradient-highest: none !important;
    }
    ${CHAT} :is([class*="chat_"], [class*="chatContent_"], [class*="messagesWrapper_"], [data-list-id="chat-messages"]) {
      background: var(--omadisc-bg) !important;
      border-radius: 0 !important;
      box-shadow: none !important;
      min-width: 0 !important;
    }
    ${CHAT} [class*="chat_"] {
      border: 0 !important;
    }
    ${CHAT} [class*="chat_"] > :is([class*="title_"], section[aria-label]) {
      background: var(--omadisc-panel) !important;
      border-bottom: 1px solid var(--omadisc-line) !important;
      border-radius: 0 !important;
      box-shadow: none !important;
      min-height: 38px !important;
      height: 38px !important;
      font-family: var(--font-primary) !important;
    }
    ${CHAT} [class*="chat_"] :is(h1, h2, h3, button, input, [role="textbox"]) {
      font-family: var(--font-primary) !important;
    }
    ${CHAT} [data-list-id="chat-messages"] {
      padding-bottom: 14px !important;
    }
    ${CHAT} ${MESSAGE} {
      background-color: transparent !important;
      border-inline-start: 2px solid transparent !important;
      border-bottom: 1px solid color-mix(in srgb, var(--omadisc-line) 35%, transparent) !important;
      border-radius: 0 !important;
      box-shadow: none !important;
      margin-block: 0 !important;
      padding: 9px 14px 9px 52px !important;
      min-height: 42px !important;
    }
    ${CHAT} ${MESSAGE}:hover {
      background-color: var(--omadisc-panel) !important;
      border-inline-start-color: var(--omadisc-line) !important;
    }
    ${CHAT} ${MESSAGE}[class*="mentioned_"] {
      border-inline-start-color: var(--omadisc-accent) !important;
      background-color: var(--omadisc-panel) !important;
    }
    ${CHAT} ${MESSAGE} :is([class*="messageContent_"], [id^="message-content-"]) {
      color: var(--omadisc-fg) !important;
      font: 13px/1.65 var(--font-primary) !important;
      letter-spacing: -.15px !important;
    }
    ${CHAT} ${MESSAGE} [class*="username_"] {
      color: var(--omadisc-accent) !important;
      font: 600 12px/1.6 var(--font-primary) !important;
    }
    ${CHAT} ${MESSAGE} :is(time, [class*="timestamp_"]) {
      color: var(--omadisc-muted) !important;
      font: 10px/1.6 var(--font-primary) !important;
    }
    ${CHAT} ${MESSAGE} img[class*="avatar_"] {
      width: 26px !important;
      height: 26px !important;
      border-radius: 4px !important;
      inset-inline-start: 13px !important;
      top: 11px !important;
    }
    ${CHAT} :is([class*="reactions_"], [class*="reaction_"]) {
      border-radius: 3px !important;
    }
    ${CHAT} [class*="reaction_"] {
      background: var(--omadisc-panel) !important;
      border-color: var(--omadisc-line) !important;
    }
    ${CHAT} [class*="reactionMe_"] {
      border-color: var(--omadisc-accent) !important;
    }
    ${CHAT} [class*="chatContent_"] > form {
      margin: 0 !important;
      padding: 12px !important;
      border-top: 1px solid var(--omadisc-line) !important;
      background: var(--omadisc-panel) !important;
    }
    ${CHAT} [class*="channelTextArea_"] {
      background: var(--omadisc-bg) !important;
      border: 1px solid var(--omadisc-line) !important;
      border-radius: 4px !important;
      box-shadow: none !important;
      margin-bottom: 0 !important;
    }
    ${CHAT} [class*="channelTextArea_"]:focus-within {
      border-color: var(--omadisc-accent) !important;
    }
    ${CHAT} [class*="scrollableContainer_"] {
      background: transparent !important;
      border-radius: 4px !important;
    }
    ${CHAT} [class*="chatContent_"] [role="textbox"] {
      font-size: 13px !important;
      color: var(--omadisc-fg) !important;
      caret-color: var(--omadisc-accent) !important;
    }
    ${CHAT} :is(pre, code) {
      font-family: var(--font-code) !important;
      border-radius: 4px !important;
    }
    ${CHAT} :focus-visible { outline-color: var(--omadisc-accent) !important; }
    ${CHAT} * { scrollbar-color: var(--omadisc-line) transparent; scrollbar-width: thin; }
    ${navigation ? '' : `
    /* Discord nests its sidebar and page inside a content subgrid. Keep its
       named grid lines so those children cannot create implicit side columns.
       This also supports the previous layout with direct grid children. */
    ${APP} {
      grid-template-areas: "notice" "page" !important;
      grid-template-columns: [start guildsEnd channelsEnd] minmax(0, 1fr) [end] !important;
      grid-template-rows: [top titleBarEnd] auto [noticeEnd] minmax(0, 1fr) [end] !important;
      --custom-guild-list-width: 0px !important;
      --custom-guild-sidebar-width: 0px !important;
      --custom-app-top-bar-height: 0px !important;
    }
    ${APP} > :is([class*="sidebar_"], [class*="guilds_"], [class*="bar_"], [class*="panels_"]),
    ${APP} > [class*="content_"] > :is([class*="sidebar_"], [class*="guilds_"], [class*="panels_"]) {
      display: none !important;
    }
    ${APP} > [class*="content_"] {
      min-width: 0 !important;
      min-height: 0 !important;
    }
    ${APP} [class*="page_"] {
      width: 100% !important;
      min-width: 0 !important;
      min-height: 0 !important;
      border: 0 !important;
      border-radius: 0 !important;
    }
    ${CHAT} [class*="chat_"] > [class*="title_"],
    ${CHAT} [class*="chat_"] > [class*="content_"] > :is([class*="membersWrap_"], [class*="container_"]:has([class*="membersWrap_"]), [class*="profilePanel_"]) {
      display: none !important;
    }
    `}
  `;
}
module.exports = { chatCSS };
