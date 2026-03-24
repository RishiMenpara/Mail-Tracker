// Pixel generator utility
// NOTE: Update TRACKING_SERVER_URL after Railway deployment
const TRACKING_SERVER_URL = 'https://YOUR_RAILWAY_APP.up.railway.app';

function generatePixelHTML(emailId, viewerId) {
  const ts = Date.now();
  const r = Math.random().toString(36).substring(2);
  const src = `${TRACKING_SERVER_URL}/pixel/${emailId}/${viewerId}?ts=${ts}&r=${r}`;
  return `<img src="${src}" width="1" height="1" style="display:none;border:0;outline:none;text-decoration:none;" alt="" />`;
}

function getTrackingServerUrl() {
  return TRACKING_SERVER_URL;
}

window.MailTrackrPixel = { generatePixelHTML, getTrackingServerUrl };
