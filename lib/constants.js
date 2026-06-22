export const TITLES = ["Mr", "Mrs", "Ms", "Miss", "Dr", "Chief", "Engr", "Prof", "Rev"];

// Common segmentation tags. Free-form tags are also allowed.
export const SUGGESTED_TAGS = ["HNW", "Institutional", "Retail", "Newsletter", "Pod 3", "Dormant"];

// Starter bodies for new templates — house style, merge tags in place. These
// are only defaults offered in the editor; authors can rewrite freely.
export const STARTER_BODIES = {
  // The birthday greeting leads with the designed Transworld card (appended by
  // renderGreeting), which carries the message and the firm's sign-off — so the
  // template body is just the personalized salutation above it.
  birthday: `<p style="margin:0;">Dear {{title}} {{last_name}},</p>`,
  holiday: `<p style="margin:0 0 16px;">Dear {{title}} {{last_name}},</p>
<p style="margin:0 0 16px;">As the season approaches, all of us at Transworld Investment &amp; Securities Limited send you our warmest wishes.</p>
<p style="margin:0 0 16px;">Thank you for your continued partnership. We wish you and your loved ones a restful and joyful celebration.</p>
<p style="margin:24px 0 0;">Warm regards,<br>The Transworld Team</p>`,
  custom: `<p style="margin:0 0 16px;">Dear {{title}} {{last_name}},</p>
<p style="margin:0 0 16px;">Write your message here.</p>
<p style="margin:24px 0 0;">Warm regards,<br>The Transworld Team</p>`,
};
