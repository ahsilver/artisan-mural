/** Keeps customer–designer chat on the site: finds emails, phone numbers, links and outside-contact handles, including spelled-out tricks. */
const NUM_WORDS: Record<string, string> = { zero: "0", oh: "0", one: "1", two: "2", three: "3", four: "4", five: "5", six: "6", seven: "7", eight: "8", nine: "9", ten: "10" };

function normalize(text: string) {
  let t = (text || "").normalize("NFKC").toLowerCase().replace(/[\u200b-\u200f\u2060\ufeff]/g, "");
  t = t.replace(/[\(\[\{]\s*(at|dot)\s*[\)\]\}]/g, " $1 ");
  return t;
}
/** Turns "five five five, one two three" into digits so spelled numbers are caught too. */
function spelledDigits(t: string) {
  return t.replace(/\b(zero|oh|one|two|three|four|five|six|seven|eight|nine)\b/g, (w) => NUM_WORDS[w]);
}
const SERVICES = "gmail|g mail|yahoo|hotmail|outlook|icloud|aol|proton(?:mail)?|live\\.com|msn|mail\\.ru|gmx|yandex|zoho";
const APPS = "whats\\s?app|wa\\.me|telegram|t\\.me|signal app|on signal|instagram|insta|\\big\\b|facebook|\\bfb\\b|messenger|tiktok|snapchat|snap me|wechat|skype|viber|linkedin|discord|twitter|\\bx\\.com|pinterest|etsy|fiverr|upwork|venmo|cash\\s?app|zelle|paypal\\.me";
const rules: [RegExp, string][] = [
  [/[\w.+-]+\s*@\s*[\w-]+\s*\.\s*[a-z]{2,}/i, "an email address"],
  [/[\w.+-]+\s*(\s|\b)(at|@)(\s|\b)\s*[\w-]+\s*(\s|\b)(dot|\.)(\s|\b)\s*(com|net|org|co|io|me|us|ca|uk|de|ru|info|biz)\b/i, "an email address"],
  [new RegExp(`\\b(${SERVICES})\\b`, "i"), "an email address"],
  [/\b(https?:\/\/|www\.)\S+/i, "a link"],
  [/\b[\w-]{2,}\s*(\.|\bdot\b)\s*(com|net|org|io|co|me|app|shop|store|art|studio|design|site|online|xyz|biz|info|ly|gg)\b/i, "a link"],
  [new RegExp(`(${APPS})`, "i"), "an outside app or social account"],
  [/(^|[\s(:])@[a-z0-9_.]{3,}/i, "a social handle"],
  [/\b(call|text|phone|ring|whats?app|message|email|e-mail|mail|dm|reach|contact)\s+(me|us)\b(?!\s+(here|on\s+(the\s+)?(site|artisan)))/i, "a request to talk outside the site"],
  [/\b(my|our)\s+(cell|mobile|phone|number|email|e-mail|whatsapp|insta(gram)?|handle|website|site)\b/i, "contact details"],
  [/\b(off|outside)\s+(the\s+)?(site|platform|app|artisan)/i, "a request to deal outside the site"],
];
const PHONE = /(\+?\d[\s().\-\/_,]{0,3}){7,}/;

export const CONTACT_BLOCKED_MESSAGE = "For your safety, contact details stay off the chat. Phone numbers, emails, links and social accounts are blocked. Talk, pay and get files here on Artisan Mural.";
export const CONTACT_NOTE = "Keep all contact on Artisan Mural. Phone numbers, emails, links and social handles are blocked, so you're always covered by the site.";

/** Returns what was found ("a phone number", "an email address" …) or null when the text is fine. */
export function findContactDetails(text: string): string | null {
  const t = normalize(text);
  const digits = spelledDigits(t);
  // numbers with units are measurements, not phones ("120 in x 96 in")
  const noDates = digits.replace(/\b\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}\b/g, " ").replace(/\$\s?[\d,]+(\.\d+)?/g, " ");
  const noMeasures = noDates.replace(/\d+(\.\d+)?\s*(ft|feet|foot|in|inch|inches|cm|mm|m|sq|sqft|x|×|by|'|"|\$|%|days?|dpi|px)\b/g, " ");
  if (PHONE.test(noMeasures)) return "a phone number";
  for (const [re, what] of rules) if (re.test(t)) return what;
  return null;
}
export function containsContactDetails(text: string) { return findContactDetails(text) !== null; }
