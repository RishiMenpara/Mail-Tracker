// Pixel generator utility
// Production backend URL
const TRACKING_SERVER_URL = 'https://mail-tracker-v60z.onrender.com';

function generatePixelHTML(emailId, viewerId) {
  const ts = Date.now();
  const r = Math.random().toString(36).substring(2);
  const src = `${TRACKING_SERVER_URL}/pixel/${emailId}/${viewerId}?ts=${ts}&r=${r}`;
  return `<img src="${src}" width="1" height="1" style="opacity:0; position:absolute; z-index:-1; border:0; outline:none; text-decoration:none;" alt="" />`;
}

function getTrackingServerUrl() {
  return TRACKING_SERVER_URL;
}

window.MailTrackrPixel = { generatePixelHTML, getTrackingServerUrl };
