export const TITLES = ["Mr", "Mrs", "Ms", "Miss", "Dr", "Chief", "Engr", "Prof", "Rev"];

// Common segmentation tags. Free-form tags are also allowed.
export const SUGGESTED_TAGS = ["HNW", "Institutional", "Retail", "Newsletter", "Pod 3", "Dormant"];

// Starter bodies for new templates — house style, merge tags in place. These
// are only defaults offered in the editor; authors can rewrite freely.
export const STARTER_BODIES = {
  birthday: `<p style="margin:0 0 16px;">Dear {{title}} {{last_name}},</p>
<p style="margin:0 0 16px;">On behalf of the Chairman and everyone at Transworld Investment &amp; Securities Limited, I write to wish you a very happy birthday.</p>
<p style="margin:0 0 16px;">We are grateful for the confidence you place in us, and we look forward to continuing to serve you in the year ahead. May it bring you good health, happiness, and prosperity.</p>
<p style="margin:24px 0 0;">Warm regards,<br>The Transworld Team</p>`,
  holiday: `<p style="margin:0 0 16px;">Dear {{title}} {{last_name}},</p>
<p style="margin:0 0 16px;">As the season approaches, all of us at Transworld Investment &amp; Securities Limited send you our warmest wishes.</p>
<p style="margin:0 0 16px;">Thank you for your continued partnership. We wish you and your loved ones a restful and joyful celebration.</p>
<p style="margin:24px 0 0;">Warm regards,<br>The Transworld Team</p>`,
  custom: `<p style="margin:0 0 16px;">Dear {{title}} {{last_name}},</p>
<p style="margin:0 0 16px;">Write your message here.</p>
<p style="margin:24px 0 0;">Warm regards,<br>The Transworld Team</p>`,
};
