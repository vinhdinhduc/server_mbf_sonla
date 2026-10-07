/* eslint-disable no-restricted-syntax, no-await-in-loop, no-continue */
import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'crypto';
import nodemailer from 'nodemailer';
import sanitizeHtml from 'sanitize-html';
import { QueryTypes } from 'sequelize';
import { sequelize } from '../config/database';
import { env, ALLOWED_ORIGINS_LIST } from '../config/env';
import { AppError } from '../utils/AppError';
import { settingService } from './setting.service';

interface SmtpSettings {
  host: string;
  port: number;
  security: 'none' | 'starttls' | 'ssl';
  username: string;
  password_enc: string | null;
  from_name: string;
  from_email: string;
  reply_to: string | null;
  bcc: string | null;
  send_limit_hour: number;
}
interface Template {
  key: string;
  name: string;
  subject: string;
  html: string;
  enabled: number | boolean;
}
interface OutboxRow {
  id: number;
  recipient: string;
  template_key: string;
  data_json: Record<string, string> | string;
  status: string;
  attempts: number;
}
const key = createHash('sha256').update(env.APP_SECRET_KEY).digest();
const allowedVariables = new Set([
  'customer_name',
  'registration_code',
  'phone',
  'status',
  'message',
  'store_name',
  'hotline',
  'branch_name',
  'item_count',
  'confirm_url',
  'unsubscribe_url',
  'appointment_date',
  'appointment_time',
  'store_address',
]);
const escapeHtml = (value: unknown) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
const cleanHeader = (value: string) => value.replace(/[\r\n]/g, ' ').trim();
const masked = (email: string) => email.replace(/^(.{1,2}).*(@.*)$/, '$1***$2');
const emailRegex = /^[^\s@\r\n]+@[^\s@\r\n]+\.[^\s@\r\n]+$/;
const publicHttpUrl = (value: string) => {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    const localHost =
      /^(localhost|.*\.localhost|.*\.local)$/i.test(hostname) ||
      /^(127\.|10\.|192\.168\.)/.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(hostname) ||
      hostname === '[::1]' ||
      hostname.startsWith('[fc') ||
      hostname.startsWith('[fd');
    return !localHost && (url.protocol === 'http:' || url.protocol === 'https:')
      ? url.toString()
      : '';
  } catch {
    return '';
  }
};
const publicSiteUrl = () =>
  [env.PUBLIC_SITE_URL, ...ALLOWED_ORIGINS_LIST, env.APP_BASE_URL]
    .map((value) => publicHttpUrl(value || ''))
    .find(Boolean)
    ?.replace(/\/$/, '') || '';
const registrationStatusLabels: Record<string, string> = {
  moi: 'Đã tiếp nhận',
  dang_xu_ly: 'Đang xử lý',
  hoan_thanh: 'Hoàn tất',
  huy: 'Từ chối',
};
const emailTemplateTags = [
  'a',
  'b',
  'blockquote',
  'br',
  'caption',
  'code',
  'div',
  'em',
  'h1',
  'h2',
  'h3',
  'h4',
  'hr',
  'i',
  'img',
  'li',
  'ol',
  'p',
  'pre',
  'span',
  'strong',
  'table',
  'tbody',
  'td',
  'tfoot',
  'th',
  'thead',
  'tr',
  'u',
  'ul',
];
function sanitizeEmailContent(input: string, publicBase = '') {
  return sanitizeHtml(input, {
    allowedTags: emailTemplateTags,
    allowedAttributes: {
      a: ['href', 'target', 'rel', 'style'],
      img: ['src', 'alt', 'width', 'height', 'style', 'align'],
      table: ['role', 'width', 'cellpadding', 'cellspacing', 'border', 'align', 'style', 'class'],
      tr: ['align', 'valign', 'style', 'bgcolor', 'class'],
      td: ['colspan', 'rowspan', 'width', 'height', 'align', 'valign', 'bgcolor', 'style', 'class'],
      th: ['colspan', 'rowspan', 'width', 'height', 'align', 'valign', 'bgcolor', 'style', 'class'],
      p: ['style'],
      h1: ['style'],
      h2: ['style'],
      h3: ['style'],
      h4: ['style'],
      div: ['style'],
      span: ['style', 'class'],
      hr: ['style'],
    },
    allowedStyles: {
      '*': {
        'text-align': [/^(left|center|right|justify)$/],
        color: [/^#[\da-f]{3,8}$/i],
        'background-color': [/^#[\da-f]{3,8}$/i],
        padding: [/^\d{1,3}(px|em|rem|%)?( \d{1,3}(px|em|rem|%)?){0,3}$/],
        'border-radius': [/^\d{1,3}(px|%)$/],
        'font-weight': [/^(normal|bold|[1-9]00)$/],
        'font-size': [/^\d{1,3}(px|rem|em)$/],
        'line-height': [/^\d+(\.\d+)?(px|%)?$/],
        'text-decoration': [/^(none|underline)$/],
        display: [/^(block|inline-block|none)$/],
        visibility: [/^(hidden|visible)$/],
        opacity: [/^(0|1|0?\.\d+)$/],
        height: [/^\d{1,3}(px|%)?$/],
        'max-height': [/^\d{1,3}(px|%)?$/],
        'max-width': [/^\d{1,3}(px|%)?$/],
        overflow: [/^(hidden|visible)$/],
        border: [/^\d{1,2}px solid #[\da-f]{3,8}$/i],
        'border-left': [/^\d{1,2}px solid #[\da-f]{3,8}$/i],
        'border-bottom': [/^\d{1,2}px solid #[\da-f]{3,8}$/i],
        'font-family': [/^[\w\s,"'-]+$/],
        'vertical-align': [/^(top|middle|bottom)$/],
        width: [/^\d{1,3}(px|%)?$/],
        margin: [/^\d{1,3}(px|em|rem|%)?( \d{1,3}(px|em|rem|%)?){0,3}$/],
      },
    },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    allowedSchemesByTag: { img: ['http', 'https'] },
    transformTags: {
      a: (_tag, attrs) => {
        const attribs = { ...attrs };
        if (attribs.href && /^tel:/i.test(attribs.href)) {
          const number = attribs.href.slice(4).replace(/[^\d+*#]/g, '');
          if (number) attribs.href = `tel:${number}`;
          else delete attribs.href;
        } else if (attribs.href && !/^mailto:/i.test(attribs.href)) {
          let normalized = '';
          try {
            normalized = publicHttpUrl(
              publicBase ? new URL(attribs.href, publicBase).toString() : attribs.href,
            );
          } catch {
            normalized = '';
          }
          if (normalized) attribs.href = normalized;
          else delete attribs.href;
        }
        return {
          tagName: 'a',
          attribs: {
            ...attribs,
            rel: attrs.target === '_blank' ? 'noopener noreferrer' : 'noopener',
          },
        };
      },
    },
  });
}
function extractTemplateVariables(value: string) {
  const variables: string[] = [];
  const expression = /{{\s*([a-z_]+)\s*}}/g;
  for (let match = expression.exec(value); match; match = expression.exec(value)) {
    variables.push(match[1]);
  }
  return variables;
}
async function emailFooterSettings() {
  const publicSettings = await settingService.listPublic();
  return {
    branch: publicSettings.footer_branch_name || publicSettings.site_name || 'MobiFone Sơn La',
    hotline: publicSettings.hotline || publicSettings.footer_phone || '18001090',
    address: publicSettings.contact_address || publicSettings.footer_address || '',
    email: publicSettings.contact_email || publicSettings.footer_email || '',
    workingHours: publicSettings.working_hours || publicSettings.footer_working_hours || '',
    logo: publicSettings.email_logo_url || '',
    facebook: publicSettings.footer_facebook_url || '',
    zalo: publicSettings.footer_zalo_url || '',
  };
}
const preheader = (text: string) =>
  `<span style="display:none;visibility:hidden;opacity:0;color:transparent;height:0;width:0;max-height:0;max-width:0;overflow:hidden">${text}</span>`;
const infoTable = (rows: string) =>
  `<table class="email-info" role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0;border-left:4px solid #0065b3;background-color:#f5f8fc">${rows.replace(/<\/table>\s*$/i, '')}</table>`;
const infoRow = (label: string, value: string) =>
  `<tr><td width="38%" style="padding:11px 14px;color:#64748b;border-bottom:1px solid #e2e8f0">${label}</td><td style="padding:11px 14px;color:#1f2937;font-weight:bold;border-bottom:1px solid #e2e8f0">${value}</td></tr>`;
const ctaTable = (label: string, href = '{{confirm_url}}') =>
  `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0"><tbody><tr><td class="email-cta-cell" align="center" bgcolor="#0065b3" style="border-radius:8px;background-color:#0065b3"><a href="${href}" style="display:inline-block;padding:14px 28px;color:#ffffff;text-decoration:none;font-weight:bold;font-family:Arial,Helvetica,sans-serif">${label}</a></td></tr></tbody></table>`;
const hotlineCta = () => ctaTable('Gọi hotline', 'tel:{{hotline}}');
const callout = (text: string) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0;background-color:#fff8e5"><tbody><tr><td style="padding:14px 16px;border-left:4px solid #f0b429;color:#59420b">${text}</td></tr></tbody></table>`;
const actionUrl = (templateKey: string) => {
  const site = publicSiteUrl();
  const paths: Record<string, string> = {
    account_created: '/admin/login',
    appointment_new_staff: '/admin/appointments',
    contact_new_staff: '/admin/contacts',
    password_reset: '/admin/forgot-password',
    registration_new_staff: '/admin/registrations',
  };
  return site ? `${site}${paths[templateKey] || '/'}` : '';
};
const templateDefaults: Record<string, { subject: string; html: string }> = {
  registration_received_customer: {
    subject: 'Đã tiếp nhận đăng ký {{registration_code}}',
    html: `${preheader('Đăng ký {{registration_code}} đã được ghi nhận. Nhân viên sẽ sớm liên hệ Quý khách.')}<h1 style="margin:0 0 16px;font-size:22px;line-height:1.35;color:#1f2937">Đã nhận đăng ký của Quý khách</h1><p>Xin chào <strong>{{customer_name}}</strong>,</p><p>Cảm ơn Quý khách đã quan tâm đến sản phẩm và dịch vụ của MobiFone Sơn La. Thông tin đăng ký đã được chuyển tới bộ phận phụ trách.</p>${infoTable(`<tbody>${infoRow('Mã đăng ký', '{{registration_code}}')}${infoRow('Số điện thoại', '{{phone}}')}${infoRow('Số sản phẩm', '{{item_count}}')}</tbody></table>`)}<p>Nhân viên sẽ liên hệ với Quý khách trong giờ làm việc. Vui lòng giữ điện thoại để không bỏ lỡ cuộc gọi tư vấn.</p>${hotlineCta()}<p>Trân trọng,<br><strong>{{branch_name}}</strong></p>`,
  },
  registration_new_staff: {
    subject: 'Cần xử lý đăng ký {{registration_code}}',
    html: `${preheader('Có đăng ký {{registration_code}} mới cần nhân viên kiểm tra và liên hệ khách hàng.')}<h1 style="margin:0 0 16px;font-size:22px;line-height:1.35">Có đăng ký mới cần xử lý</h1><p>Hệ thống vừa tiếp nhận một đăng ký từ website. Anh/Chị vui lòng kiểm tra thông tin và chủ động liên hệ khách hàng.</p>${infoTable(`<tbody>${infoRow('Mã đăng ký', '{{registration_code}}')}${infoRow('Khách hàng', '{{customer_name}}')}${infoRow('Điện thoại', '<a href="tel:{{phone}}" style="color:#0065b3;font-weight:bold;text-decoration:none">{{phone}}</a>')}${infoRow('Số sản phẩm', '{{item_count}}')}</tbody></table>`)}${ctaTable('Xử lý đăng ký')}<p>Trân trọng,<br><strong>{{branch_name}}</strong></p>`,
  },
  registration_status_changed: {
    subject: 'Cập nhật đăng ký {{registration_code}}: {{status}}',
    html: `${preheader('Trạng thái đăng ký {{registration_code}} vừa được cập nhật.')}<h1 style="margin:0 0 16px;font-size:22px;line-height:1.35">Cập nhật đăng ký</h1><p>Xin chào <strong>{{customer_name}}</strong>, trạng thái đăng ký của Quý khách vừa được cập nhật.</p>${infoTable(`<tbody>${infoRow('Mã đăng ký', '{{registration_code}}')}<tr><td width="38%" style="padding:11px 14px;color:#64748b">Trạng thái</td><td style="padding:11px 14px"><span class="registration-status-badge" style="display:inline-block;padding:5px 10px;border-radius:16px;background-color:#e0f2fe;color:#075985;font-weight:bold">{{status}}</span></td></tr></tbody></table>`)}${callout('<strong>Ghi chú:</strong> {{message}}')}<p>Nếu cần hỗ trợ thêm, Quý khách vui lòng gọi hotline.</p>${hotlineCta()}<p>Trân trọng,<br><strong>{{branch_name}}</strong></p>`,
  },
  contact_new_staff: {
    subject: 'Liên hệ mới từ {{customer_name}}',
    html: `${preheader('Có liên hệ mới từ {{customer_name}} cần được tiếp nhận.')}<h1 style="margin:0 0 16px;font-size:22px;line-height:1.35">Có liên hệ mới</h1><p>Anh/Chị vui lòng xem nội dung bên dưới và phản hồi khách hàng theo quy trình của chi nhánh.</p>${infoTable(`<tbody>${infoRow('Khách hàng', '{{customer_name}}')}${infoRow('Điện thoại', '<a href="tel:{{phone}}" style="color:#0065b3;font-weight:bold;text-decoration:none">{{phone}}</a>')}</tbody></table>`)}${callout('<strong>Nội dung liên hệ</strong><br>{{message}}')}${ctaTable('Xem trong admin')}<p>Trân trọng,<br><strong>{{branch_name}}</strong></p>`,
  },
  contact_received_customer: {
    subject: 'Đã nhận liên hệ của bạn',
    html: `${preheader('MobiFone Sơn La đã nhận được liên hệ và chuyển tới chi nhánh phụ trách.')}<h1 style="margin:0 0 16px;font-size:22px;line-height:1.35">Cảm ơn Quý khách đã liên hệ</h1><p>Xin chào <strong>{{customer_name}}</strong>,</p><p>Chúng tôi đã tiếp nhận thông tin và chuyển tới chi nhánh phụ trách. Nhân viên sẽ phản hồi Quý khách trong giờ làm việc gần nhất.</p>${callout('<strong>Nội dung đã gửi</strong><br>{{message}}')}<p>Nếu cần hỗ trợ gấp, Quý khách có thể gọi trực tiếp hotline.</p>${hotlineCta()}<p>Trân trọng,<br><strong>{{branch_name}}</strong></p>`,
  },
  appointment_confirmed: {
    subject: 'Xác nhận lịch hẹn tại {{store_name}}',
    html: `${preheader('Lịch hẹn tại {{store_name}} đã được ghi nhận.')}<h1 style="margin:0 0 16px;font-size:22px;line-height:1.35">Đã ghi nhận lịch hẹn</h1><p>Xin chào <strong>{{customer_name}}</strong>,</p><p>Cảm ơn Quý khách đã đặt lịch tại MobiFone Sơn La. Cửa hàng sẽ liên hệ để xác nhận thông tin trước khi đón tiếp.</p>${infoTable(`<tbody>${infoRow('Cửa hàng', '{{store_name}}')}${infoRow('Thời gian', '{{appointment_date}} · {{appointment_time}}')}${infoRow('Địa chỉ', '{{store_address}}')}${infoRow('Số điện thoại', '{{phone}}')}</tbody></table>`)}${callout('Khi đến cửa hàng, Quý khách vui lòng mang theo CCCD/giấy tờ tùy thân để được hỗ trợ nhanh chóng.')}<p>Hẹn gặp Quý khách tại cửa hàng.</p>${hotlineCta()}<p>Trân trọng,<br><strong>{{branch_name}}</strong></p>`,
  },
  appointment_new_staff: {
    subject: 'Lịch hẹn mới tại {{store_name}}',
    html: `${preheader('Có lịch hẹn mới tại {{store_name}} cần nhân viên xác nhận.')}<h1 style="margin:0 0 16px;font-size:22px;line-height:1.35">Cần xác nhận lịch hẹn mới</h1><p>Một khách hàng vừa gửi yêu cầu đặt lịch. Anh/Chị vui lòng gọi xác nhận và cập nhật lịch trên hệ thống.</p>${infoTable(`<tbody>${infoRow('Khách hàng', '{{customer_name}}')}${infoRow('Điện thoại', '<a href="tel:{{phone}}" style="color:#0065b3;font-weight:bold;text-decoration:none">{{phone}}</a>')}${infoRow('Cửa hàng', '{{store_name}}')}${infoRow('Thời gian', '{{appointment_date}} · {{appointment_time}}')}${infoRow('Địa chỉ', '{{store_address}}')}</tbody></table>`)}${ctaTable('Xử lý lịch hẹn')}<p>Trân trọng,<br><strong>{{branch_name}}</strong></p>`,
  },
  account_created: {
    subject: 'Tài khoản quản trị đã được tạo',
    html: `${preheader('Tài khoản quản trị MobiFone Sơn La của Anh/Chị đã sẵn sàng.')}<h1 style="margin:0 0 16px;font-size:22px;line-height:1.35">Chào mừng Anh/Chị</h1><p>Xin chào <strong>{{customer_name}}</strong>,</p><p>Tài khoản quản trị MobiFone Sơn La đã được tạo. Anh/Chị có thể đăng nhập bằng thông tin do quản trị viên cung cấp.</p>${ctaTable('Đăng nhập hệ thống')}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0;background-color:#fff8e5"><tbody><tr><td style="padding:14px 16px;border-left:4px solid #f0b429;color:#59420b"><strong>Lưu ý bảo mật:</strong> Hãy đổi mật khẩu ngay trong lần đăng nhập đầu tiên. Email này không chứa mật khẩu.</td></tr></tbody></table><p>Nếu cần hỗ trợ, Anh/Chị vui lòng liên hệ quản trị viên.</p>`,
  },
  password_reset: {
    subject: 'Mã xác thực đặt lại mật khẩu MobiFone Sơn La',
    html: `${preheader('Mã OTP đặt lại mật khẩu có hiệu lực trong 5 phút.')}<h1 style="margin:0 0 16px;font-size:22px;line-height:1.35">Đặt lại mật khẩu</h1><p>Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của Quý khách. Nhập mã xác thực dưới đây để tiếp tục:</p><table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0;background-color:#f5f8fc;border-left:4px solid #0065b3"><tbody><tr><td style="padding:16px 22px;color:#0065b3;font-size:30px;font-weight:bold">{{message}}</td></tr></tbody></table><p>Mã có hiệu lực trong <strong>5 phút</strong> và chỉ sử dụng một lần. Không chia sẻ mã này với bất kỳ ai.</p>${ctaTable('Tiếp tục đặt lại mật khẩu')} ${callout('Nếu Quý khách không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này. Tài khoản vẫn an toàn.')}`,
  },
};

export function encryptSmtpPassword(password: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const content = Buffer.concat([cipher.update(password, 'utf8'), cipher.final()]);
  return `${iv.toString('base64')}.${cipher.getAuthTag().toString('base64')}.${content.toString('base64')}`;
}
export function decryptSmtpPassword(value: string): string {
  const [iv, tag, content] = value.split('.');
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(content, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}
export function renderEmail(template: Template, data: Record<string, unknown>) {
  const site = publicSiteUrl();
  const footerData = data.email_footer as
    Awaited<ReturnType<typeof emailFooterSettings>> | undefined;
  const emailData: Record<string, unknown> = {
    ...data,
    branch_name: data.branch_name || footerData?.branch || data.store_name || 'MobiFone Sơn La',
    hotline: data.hotline || footerData?.hotline || '18001090',
    confirm_url: data.confirm_url || actionUrl(template.key),
  };
  const valueFor = (variable: string) => {
    const value = emailData[variable];
    if (variable === 'confirm_url' || variable === 'unsubscribe_url') {
      if (typeof value !== 'string') return '';
      try {
        return publicHttpUrl(site ? new URL(value, site).toString() : value);
      } catch {
        return '';
      }
    }
    if (variable === 'status' && typeof value === 'string') {
      return registrationStatusLabels[value] ?? value;
    }
    return value;
  };
  const replace = (_: string, variable: string) =>
    allowedVariables.has(variable) ? escapeHtml(valueFor(variable)) : '';
  const subject = cleanHeader(
    template.subject.replace(/{{\s*([a-z_]+)\s*}}/g, (_match, variable) =>
      allowedVariables.has(variable) ? cleanHeader(String(valueFor(variable) ?? '')) : '',
    ),
  );
  const footer = data.email_footer as Awaited<ReturnType<typeof emailFooterSettings>> | undefined;
  const configuredLogo = footer?.logo ? publicHttpUrl(footer.logo) : '';
  const logoCandidate =
    configuredLogo && /\.(png|jpe?g)(?:[?#].*)?$/i.test(configuredLogo)
      ? configuredLogo
      : site
        ? publicHttpUrl(`${site}/logo.png`)
        : '';
  const logoUrl = logoCandidate;
  const logo = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" alt="MobiFone Sơn La" width="200" height="37" style="display:block;border:0;width:200px;height:37px;margin:0 auto" />`
    : '<div style="font:bold 24px/1.3 Arial,Helvetica,sans-serif;color:#ffffff">MobiFone Sơn La</div>';
  const branchText = footer?.branch || data.branch_name || data.store_name || 'MobiFone Sơn La';
  const branchName = escapeHtml(branchText);
  const hotlineValue = footer?.hotline || String(data.hotline || '18001090');
  const hotline = escapeHtml(hotlineValue);
  const hotlineNumber = hotlineValue.replace(/[^\d+*#]/g, '');
  const phoneLink = `<a href="tel:${hotlineNumber}" style="color:#0065b3;text-decoration:none">${hotline}</a>`;
  const address = footer?.address ? `<br>${escapeHtml(footer.address)}` : '';
  const email = footer?.email
    ? `<br><a href="mailto:${escapeHtml(footer.email)}" style="color:#0065b3;text-decoration:none">${escapeHtml(footer.email)}</a>`
    : '';
  const workingHours = footer?.workingHours ? `<br>${escapeHtml(footer.workingHours)}` : '';
  const facebookUrl = footer?.facebook ? publicHttpUrl(footer.facebook) : '';
  const zaloUrl = footer?.zalo ? publicHttpUrl(footer.zalo) : '';
  const facebook = facebookUrl
    ? `<a href="${escapeHtml(facebookUrl)}" style="color:#0065b3;text-decoration:underline">Facebook</a>`
    : '';
  const zalo = zaloUrl
    ? `<a href="${escapeHtml(zaloUrl)}" style="color:#0065b3;text-decoration:underline">Zalo</a>`
    : '';
  const social = facebook && zalo ? `${facebook} &nbsp;|&nbsp; ${zalo}` : facebook || zalo;
  const copyright = `© ${new Date().getFullYear()} ${branchName}. Bảo lưu mọi quyền.`;
  let bodyTemplate = template.html.replace(
    /<(tr|blockquote|p)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,
    (block) => {
      const variables = extractTemplateVariables(block);
      return variables.some((variable) => !String(valueFor(variable) ?? '').trim()) ? '' : block;
    },
  );
  bodyTemplate = bodyTemplate.replace(/<table\b[^>]*>\s*<tbody>\s*<\/tbody>\s*<\/table>/gi, '');
  const status = String(emailData.status ?? '');
  const badgeColors: Record<string, string> = {
    moi: 'background-color:#e0f2fe;color:#075985',
    dang_xu_ly: 'background-color:#fef3c7;color:#92400e',
    hoan_thanh: 'background-color:#dcfce7;color:#166534',
    huy: 'background-color:#fee2e2;color:#991b1b',
  };
  const badgeStyle = badgeColors[status] || 'background-color:#e0f2fe;color:#075985';
  bodyTemplate = bodyTemplate.replace(
    /<span\b(?=[^>]*class=["']registration-status-badge["'])[^>]*>/i,
    `<span style="display:inline-block;padding:5px 10px;border-radius:16px;${badgeStyle};font-weight:bold">`,
  );
  const body = sanitizeEmailContent(bodyTemplate.replace(/{{\s*([a-z_]+)\s*}}/g, replace), site);
  const html = `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark"><style>@media only screen and (max-width:480px){.email-shell{width:100%!important}.email-content{padding:20px!important}.email-info td{display:block!important;width:auto!important}.email-cta-cell{display:block!important;width:100%!important}.email-cta-cell a{display:block!important;padding:14px 20px!important}.email-footer{padding:20px!important}}@media(prefers-color-scheme:dark){.email-outer{background-color:#111827!important}.email-shell,.email-content{background-color:#1f2937!important;color:#e5e7eb!important}.email-footer{background-color:#172331!important;color:#d1d5db!important}.email-body-text,.email-info td{color:#e5e7eb!important}.email-info{background-color:#263548!important}}</style></head><body class="email-outer" style="margin:0;padding:24px 8px;background-color:#f3f6fa;font-family:Arial,Helvetica,'Segoe UI',sans-serif;color:#1f2937"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tbody><tr><td align="center"><table class="email-shell" role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;border-collapse:separate;border-spacing:0;background-color:#ffffff;border-radius:12px;overflow:hidden"><tbody><tr><td align="center" bgcolor="#0065b3" style="padding:28px 20px 24px;background-color:#0065b3;color:#ffffff">${logo}<div style="padding-top:8px;font:13px/1.4 Arial,Helvetica,sans-serif;color:#ffffff">Đồng hành cùng Quý khách</div></td></tr><tr><td height="4" bgcolor="#e31837" style="height:4px;background-color:#e31837;font-size:0;line-height:0">&nbsp;</td></tr><tr><td class="email-content email-body-text" style="padding:34px 32px;background-color:#ffffff;font-family:Arial,Helvetica,'Segoe UI',sans-serif;font-size:15px;line-height:1.65;color:#1f2937">${body}</td></tr><tr><td class="email-footer" style="padding:24px 32px;background-color:#eef3f8;color:#334155;font:13px/1.7 Arial,Helvetica,sans-serif"><strong style="font-size:14px">${branchName}</strong><br>Hotline: ${phoneLink}${email}${address}${workingHours}${social ? `<br>${social}` : ''}<br><span style="color:#64748b">Đây là email tự động, vui lòng không trả lời trực tiếp.</span><br><span style="color:#64748b">${copyright}</span></td></tr></tbody></table></td></tr></tbody></table></body></html>`;
  return {
    subject,
    html,
    text: html
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
  };
}

async function settings(): Promise<SmtpSettings> {
  const rows = await sequelize.query<SmtpSettings>('SELECT * FROM email_smtp_settings WHERE id=1', {
    type: QueryTypes.SELECT,
  });
  return (
    rows[0] || {
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      security: env.SMTP_PORT === 465 ? 'ssl' : 'starttls',
      username: env.SMTP_USER,
      password_enc: null,
      from_name: 'MobiFone Sơn La',
      from_email: env.SMTP_FROM,
      reply_to: null,
      bcc: null,
      send_limit_hour: 200,
    }
  );
}
async function transport(config?: SmtpSettings) {
  const setting = config || (await settings());
  const password = setting.password_enc ? decryptSmtpPassword(setting.password_enc) : env.SMTP_PASS;
  if (!setting.host || !setting.username || !password || !emailRegex.test(setting.from_email)) {
    throw AppError.badRequest(
      'Chưa cấu hình SMTP đầy đủ. Vui lòng nhập host, tài khoản, mật khẩu và email gửi tại mục Email & thông báo.',
    );
  }
  const transporter = nodemailer.createTransport({
    host: setting.host,
    port: Number(setting.port),
    secure: setting.security === 'ssl',
    requireTLS: setting.security === 'starttls',
    auth: { user: setting.username, pass: password },
    connectionTimeout: 5000,
    greetingTimeout: 5000,
    socketTimeout: 8000,
  });
  return { transporter, setting };
}

async function smtpOperation<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof AppError) throw error;
    const code = (error as { code?: string })?.code;
    const messages: Record<string, string> = {
      EAUTH: 'Xác thực SMTP thất bại. Kiểm tra tài khoản và mật khẩu SMTP.',
      ECONNECTION: 'Không kết nối được máy chủ SMTP. Kiểm tra host và port.',
      ESOCKET: 'Kết nối SMTP thất bại. Kiểm tra host, port và cấu hình TLS.',
      ETIMEDOUT: 'Máy chủ SMTP không phản hồi trong thời gian cho phép.',
      EDNS: 'Không tìm thấy máy chủ SMTP. Kiểm tra host.',
      ETLS: 'Không thiết lập được kết nối TLS với máy chủ SMTP.',
      EENVELOPE: 'Máy chủ SMTP từ chối địa chỉ gửi hoặc nhận.',
      EMESSAGE: 'Máy chủ SMTP từ chối nội dung thư.',
    };
    throw new AppError(
      messages[code || ''] || 'Gửi email thất bại. Kiểm tra cấu hình SMTP và thử lại.',
      502,
    );
  }
}

export const emailService = {
  async sendPasswordReset(recipient: string, code: string) {
    if (!emailRegex.test(recipient)) throw AppError.badRequest('Email không hợp lệ');
    const { transporter, setting } = await transport();
    const rows = await sequelize.query<Template>('SELECT * FROM email_templates WHERE `key`=:key', {
      replacements: { key: 'password_reset' },
      type: QueryTypes.SELECT,
    });
    const template = rows[0]?.enabled
      ? rows[0]
      : {
          key: 'password_reset',
          name: 'Đặt lại mật khẩu',
          enabled: true,
          ...templateDefaults.password_reset,
        };
    const rendered = renderEmail(template, {
      email_footer: await emailFooterSettings(),
      confirm_url: actionUrl('password_reset'),
      message: code,
    });
    await transporter.sendMail({
      from: { name: cleanHeader(setting.from_name), address: setting.from_email },
      to: recipient,
      ...rendered,
    });
  },
  async config() {
    const setting = await settings();
    return {
      ...setting,
      password_enc: undefined,
      password_configured: Boolean(setting.password_enc || env.SMTP_PASS),
    };
  },
  async saveConfig(
    input: Omit<SmtpSettings, 'password_enc' | 'reply_to' | 'bcc'> & {
      password?: string;
      reply_to?: string | null;
      bcc?: string | null;
    },
  ) {
    if (
      !emailRegex.test(input.from_email) ||
      (input.reply_to && !emailRegex.test(input.reply_to)) ||
      (input.bcc && !emailRegex.test(input.bcc))
    )
      throw AppError.badRequest('Địa chỉ email không hợp lệ');
    const old = await settings();
    const password = input.password ? encryptSmtpPassword(input.password) : old.password_enc;
    await sequelize.query(
      'INSERT INTO email_smtp_settings(id,host,port,security,username,password_enc,from_name,from_email,reply_to,bcc,send_limit_hour,updated_at) VALUES (1,:host,:port,:security,:username,:password,:fromName,:fromEmail,:replyTo,:bcc,:limit,NOW()) ON DUPLICATE KEY UPDATE host=VALUES(host),port=VALUES(port),security=VALUES(security),username=VALUES(username),password_enc=VALUES(password_enc),from_name=VALUES(from_name),from_email=VALUES(from_email),reply_to=VALUES(reply_to),bcc=VALUES(bcc),send_limit_hour=VALUES(send_limit_hour),updated_at=NOW()',
      {
        replacements: {
          host: input.host,
          port: input.port,
          security: input.security,
          username: input.username,
          password,
          fromName: cleanHeader(input.from_name),
          fromEmail: cleanHeader(input.from_email),
          replyTo: input.reply_to || null,
          bcc: input.bcc || null,
          limit: input.send_limit_hour,
        },
      },
    );
    return this.config();
  },
  async verify() {
    const { transporter } = await transport();
    await smtpOperation(() => transporter.verify());
    return { ok: true };
  },
  async sendTest(recipient: string, draft?: { key: string; subject: string; html: string }) {
    if (!emailRegex.test(recipient)) throw AppError.badRequest('Email không hợp lệ');
    if (
      draft &&
      extractTemplateVariables(`${draft.subject} ${draft.html}`).some(
        (variable) => !allowedVariables.has(variable),
      )
    )
      throw AppError.badRequest('Mẫu thư chứa biến không được hỗ trợ');
    const { transporter, setting } = await transport();
    const testData = {
      customer_name: 'Nguyễn Văn A',
      registration_code: 'DK-2025-0001',
      phone: '0901 234 567',
      status: 'Đã tiếp nhận',
      message: draft?.key === 'password_reset' ? '012345' : 'Quý khách vui lòng giữ máy',
      store_name: 'Cửa hàng MobiFone Sơn La',
      hotline: '0212 3758 758',
      branch_name: 'MobiFone Sơn La',
      item_count: '3',
      appointment_date: '02/10/2026',
      appointment_time: '09:30',
      store_address: '96B Đường 3/2, Phường Tô Hiệu, Tỉnh Sơn La',
      confirm_url: draft ? actionUrl(draft.key) : 'https://mobifone-sonla.vn/xac-nhan',
      unsubscribe_url: 'https://mobifone-sonla.vn/bo-nhan-thu',
      email_footer: await emailFooterSettings(),
    };
    await smtpOperation(() =>
      transporter.sendMail({
        from: { name: cleanHeader(setting.from_name), address: setting.from_email },
        to: recipient,
        replyTo: setting.reply_to || undefined,
        ...renderEmail(
          draft
            ? { ...draft, name: draft.key, enabled: true }
            : {
                key: 'test',
                name: 'test',
                enabled: true,
                subject: 'Kiểm tra email MobiFone Sơn La',
                html: '<p>Thư thử nghiệm tiếng Việt: MobiFone Sơn La.</p>',
              },
          testData,
        ),
      }),
    );
    return { sent: true, recipient: masked(recipient) };
  },
  async templates() {
    return sequelize.query<Template>('SELECT * FROM email_templates ORDER BY `key`', {
      type: QueryTypes.SELECT,
    });
  },
  async saveTemplate(
    templateKey: string,
    input: { subject: string; html: string; enabled: boolean },
  ) {
    const rows = await sequelize.query<Template>('SELECT * FROM email_templates WHERE `key`=:key', {
      replacements: { key: templateKey },
      type: QueryTypes.SELECT,
    });
    if (!rows[0]) throw AppError.notFound('Mẫu thư không tồn tại');
    const variables = extractTemplateVariables(`${input.subject} ${input.html}`);
    if (variables.some((variable) => !allowedVariables.has(variable)))
      throw AppError.badRequest('Mẫu thư chứa biến không được hỗ trợ');
    await sequelize.query(
      'UPDATE email_templates SET subject=:subject,html=:html,enabled=:enabled,updated_at=NOW() WHERE `key`=:key',
      {
        replacements: {
          subject: cleanHeader(input.subject),
          html: sanitizeEmailContent(input.html),
          enabled: input.enabled,
          key: templateKey,
        },
      },
    );
  },
  async preview(templateKey: string, data: Record<string, unknown> = {}) {
    const rows = await sequelize.query<Template>('SELECT * FROM email_templates WHERE `key`=:key', {
      replacements: { key: templateKey },
      type: QueryTypes.SELECT,
    });
    if (!rows[0]) throw AppError.notFound('Mẫu thư không tồn tại');
    return renderEmail(rows[0], {
      customer_name: 'Nguyễn Văn A',
      registration_code: 'DK-260922-0001',
      phone: '0901 234 567',
      status: 'Đã tiếp nhận',
      message: templateKey === 'password_reset' ? '012345' : 'Quý khách vui lòng giữ máy',
      store_name: 'MobiFone Sơn La',
      hotline: '18001090',
      branch_name: 'MobiFone Sơn La',
      item_count: '3',
      appointment_date: '02/10/2026',
      appointment_time: '09:30',
      store_address: '96B Đường 3/2, Phường Tô Hiệu, Tỉnh Sơn La',
      confirm_url: 'https://mobifone-sonla.vn/xac-nhan',
      unsubscribe_url: 'https://mobifone-sonla.vn/bo-nhan-thu',
      email_footer: await emailFooterSettings(),
      ...data,
    });
  },
  async restoreTemplate(templateKey: string) {
    const preset = templateDefaults[templateKey];
    if (!preset) throw AppError.notFound('Mẫu thư không tồn tại');
    await this.saveTemplate(templateKey, { ...preset, enabled: true });
  },
  async enqueue(
    recipient: string | null | undefined,
    templateKey: string,
    data: Record<string, unknown>,
    idempotencyKey: string,
  ) {
    if (!recipient || !emailRegex.test(recipient)) return;
    const rows = await sequelize.query<Template>(
      'SELECT `key`,enabled FROM email_templates WHERE `key`=:key',
      { replacements: { key: templateKey }, type: QueryTypes.SELECT },
    );
    if (!rows[0] || !rows[0].enabled) return;
    const allowedData = Object.fromEntries(
      Object.entries(data)
        .filter(([name]) => allowedVariables.has(name))
        .map(([name, value]) => [name, String(value ?? '').slice(0, 1000)]),
    );
    await sequelize.query(
      "INSERT IGNORE INTO email_outbox(idempotency_key,recipient,template_key,data_json,status,attempts,next_attempt_at,created_at) VALUES (:id,:recipient,:template,:data,'queued',0,NOW(),NOW())",
      {
        replacements: {
          id: idempotencyKey,
          recipient: recipient.toLowerCase(),
          template: templateKey,
          data: JSON.stringify(allowedData),
        },
      },
    );
  },
  async logs(page = 1) {
    const rows = await sequelize.query<OutboxRow>(
      'SELECT id,recipient,template_key,status,attempts,last_error,created_at,sent_at FROM email_outbox ORDER BY id DESC LIMIT 50 OFFSET :offset',
      { replacements: { offset: (page - 1) * 50 }, type: QueryTypes.SELECT },
    );
    return rows.map((row) => ({ ...row, recipient: masked(row.recipient) }));
  },
  async retry(id: number) {
    await sequelize.query(
      "UPDATE email_outbox SET status='queued',attempts=0,next_attempt_at=NOW(),last_error=NULL,claim_token=NULL,locked_at=NULL WHERE id=:id AND status IN ('failed','suppressed')",
      { replacements: { id } },
    );
  },
  async suppress(email: string, reason: string) {
    if (!emailRegex.test(email)) throw AppError.badRequest('Email không hợp lệ');
    await sequelize.query(
      'INSERT INTO email_suppressions(email,reason,created_at) VALUES (:email,:reason,NOW()) ON DUPLICATE KEY UPDATE reason=VALUES(reason)',
      { replacements: { email: email.toLowerCase(), reason } },
    );
  },
  async unsuppress(email: string) {
    await sequelize.query('DELETE FROM email_suppressions WHERE email=:email', {
      replacements: { email: email.toLowerCase() },
    });
  },
  async suppressions() {
    return sequelize.query<{ email: string; reason: string }>(
      'SELECT email,reason FROM email_suppressions ORDER BY created_at DESC',
      { type: QueryTypes.SELECT },
    );
  },
};

export async function processEmailOutbox() {
  await sequelize.query(
    "UPDATE email_outbox SET status='queued',claim_token=NULL WHERE status='processing' AND locked_at<DATE_SUB(NOW(),INTERVAL 5 MINUTE)",
  );
  const rows = await sequelize.query<OutboxRow>(
    "SELECT id,recipient,template_key,data_json,status,attempts FROM email_outbox WHERE status='queued' AND next_attempt_at<=NOW() ORDER BY id LIMIT 10",
    { type: QueryTypes.SELECT },
  );
  const footer = rows.length > 0 ? await emailFooterSettings() : undefined;
  for (const row of rows) {
    const claim = randomUUID();
    const [result] = await sequelize.query(
      "UPDATE email_outbox SET status='processing',locked_at=NOW(),claim_token=:claim WHERE id=:id AND status='queued'",
      { replacements: { claim, id: row.id } },
    );
    if (!(result as { affectedRows?: number }).affectedRows) continue;
    try {
      const suppressed = await sequelize.query(
        'SELECT email FROM email_suppressions WHERE email=:email',
        { replacements: { email: row.recipient }, type: QueryTypes.SELECT },
      );
      if (suppressed.length) {
        await sequelize.query(
          "UPDATE email_outbox SET status='suppressed' WHERE id=:id AND claim_token=:claim",
          { replacements: { id: row.id, claim } },
        );
        continue;
      }
      const templates = await sequelize.query<Template>(
        'SELECT * FROM email_templates WHERE `key`=:key',
        { replacements: { key: row.template_key }, type: QueryTypes.SELECT },
      );
      if (!templates[0] || !templates[0].enabled) {
        await sequelize.query(
          "UPDATE email_outbox SET status='suppressed' WHERE id=:id AND claim_token=:claim",
          { replacements: { id: row.id, claim } },
        );
        continue;
      }
      const setting = await settings();
      const sent = await sequelize.query<{ count: number }>(
        "SELECT COUNT(*) AS count FROM email_outbox WHERE status='sent' AND sent_at>DATE_SUB(NOW(),INTERVAL 1 HOUR)",
        { type: QueryTypes.SELECT },
      );
      if (Number(sent[0].count) >= setting.send_limit_hour) {
        await sequelize.query(
          "UPDATE email_outbox SET status='queued',next_attempt_at=DATE_ADD(NOW(),INTERVAL 5 MINUTE),claim_token=NULL WHERE id=:id AND claim_token=:claim",
          { replacements: { id: row.id, claim } },
        );
        continue;
      }
      const { transporter } = await transport(setting);
      const data = typeof row.data_json === 'string' ? JSON.parse(row.data_json) : row.data_json;
      const rendered = renderEmail(templates[0], {
        ...data,
        email_footer: data.email_footer || footer,
      });
      const delivery = await transporter.sendMail({
        from: { name: cleanHeader(setting.from_name), address: setting.from_email },
        to: row.recipient,
        replyTo: setting.reply_to || undefined,
        bcc: setting.bcc || undefined,
        ...rendered,
      });
      // SMTP may accept only the internal BCC while rejecting the customer.
      if (
        delivery.rejected?.some(
          (address) => String(address).toLowerCase() === row.recipient.toLowerCase(),
        )
      ) {
        throw Object.assign(new Error('Recipient rejected'), { code: 'EENVELOPE' });
      }
      await sequelize.query(
        "UPDATE email_outbox SET status='sent',attempts=attempts+1,sent_at=NOW(),claim_token=NULL,last_error=NULL WHERE id=:id AND claim_token=:claim",
        { replacements: { id: row.id, claim } },
      );
    } catch (error) {
      const attempt = Number(row.attempts) + 1;
      const delay = Math.min(3600, 30 * 2 ** (attempt - 1));
      const code =
        typeof error === 'object' && error && 'code' in error
          ? String((error as { code: unknown }).code).slice(0, 40)
          : 'SEND_ERROR';
      await sequelize.query(
        'UPDATE email_outbox SET status=:status,attempts=:attempts,next_attempt_at=DATE_ADD(NOW(),INTERVAL :delay SECOND),last_error=:error,claim_token=NULL WHERE id=:id AND claim_token=:claim',
        {
          replacements: {
            status: attempt >= 3 ? 'failed' : 'queued',
            attempts: attempt,
            delay,
            error: code,
            id: row.id,
            claim,
          },
        },
      );
    }
  }
}

let running = false;
export function scheduleEmailWorker() {
  const timer = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      await processEmailOutbox();
    } catch {
      /* DB unavailable: retry next tick */
    } finally {
      running = false;
    }
  }, 15_000);
  timer.unref();
}
