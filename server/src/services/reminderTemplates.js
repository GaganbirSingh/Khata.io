// Pure data, shared by the server and the browser demo build.
// Ready-made reminders used when AI is off or its answer fails checks.
// Written to be respectful: no threats, no shaming, no fees.
const TEMPLATES = {
  hi: {
    polite:
      'Namaste {NAME} ji, {SHOP} se yaad dila rahe hain ki aapka {AMOUNT} baaki hai. Aap is link se UPI se pay kar sakte hain: {LINK} Dhanyavaad!',
    friendly:
      'Hello {NAME} ji! {SHOP} ki taraf se chhota sa reminder: aapka {AMOUNT} baaki hai. Jab time mile, is link se pay kar dijiye: {LINK} Shukriya!',
    firm: 'Namaste {NAME} ji, aapka {AMOUNT} kaafi samay se baaki hai. Kripya jaldi is link se payment kar dijiye: {LINK} - {SHOP}',
  },
  pa: {
    polite:
      'Sat Sri Akal {NAME} ji, {SHOP} vallon yaad karvaunde haan ki tuhada {AMOUNT} baaki hai. Tusi is link naal UPI rahi pay kar sakde ho: {LINK} Dhanvaad!',
    friendly:
      'Sat Sri Akal {NAME} ji! {SHOP} vallon chhota jeha reminder: tuhada {AMOUNT} baaki hai. Jadon time mile, is link naal pay kar dena: {LINK} Shukriya!',
    firm: 'Sat Sri Akal {NAME} ji, tuhada {AMOUNT} kaafi samay ton baaki hai. Kirpa karke jaldi is link naal payment kar dena: {LINK} - {SHOP}',
  },
  en: {
    polite:
      'Hello {NAME}, this is a gentle reminder from {SHOP} that {AMOUNT} is pending on your account. You can pay by UPI here: {LINK} Thank you!',
    friendly: 'Hi {NAME}! Quick note from {SHOP}: {AMOUNT} is pending on your khata. Pay whenever convenient: {LINK} Thanks!',
    firm: 'Hello {NAME}, {AMOUNT} has been pending on your account with {SHOP} for some time. Please clear it soon using this link: {LINK}',
  },
};

module.exports = { TEMPLATES };
