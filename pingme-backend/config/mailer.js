const nodemailer = require("nodemailer");
const dns = require("dns").promises;

const getTransporter = async () => {
    const host = (process.env.SMTP_HOST || "smtp.gmail.com").trim();
    // Default to port 465 (SSL) for reliable cloud deployment (e.g. Render)
    const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 465;
    const secure = port === 465;

    let resolvedHost = host;
    try {
        // Force IPv4 DNS lookup to prevent ENETUNREACH IPv6 errors in cloud environments like Render
        const result = await dns.lookup(host, { family: 4 });
        resolvedHost = result.address;
        console.log(`[Mailer] Resolved ${host} to IPv4 address: ${resolvedHost}`);
    } catch (dnsErr) {
        console.warn(`[Mailer] DNS lookup failed for ${host}, using hostname directly:`, dnsErr.message);
    }

    return nodemailer.createTransport({
        host: resolvedHost,
        port,
        secure,
        auth: {
            user: (process.env.SMTP_USER || "").trim(),
            pass: (process.env.SMTP_PASS || "").trim(),
        },
        tls: {
            rejectUnauthorized: false,
            servername: host, // Must specify original hostname for certificate validation
        },
    });
};

const sendMailCustom = async ({ to, subject, html }) => {
    // 1. Try Brevo HTTP API
    if (process.env.BREVO_API_KEY) {
        console.log(`[Mailer] Sending email to ${to} via Brevo HTTP API (Port 443)...`);
        const response = await fetch("https://api.brevo.com/v3/smtp/email", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "api-key": process.env.BREVO_API_KEY.trim()
            },
            body: JSON.stringify({
                sender: { name: "PingMe", email: (process.env.SMTP_USER || "supportpingmechat@gmail.com").trim() },
                to: [{ email: to }],
                subject: subject,
                htmlContent: html
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Brevo API returned status ${response.status}: ${errText}`);
        }

        const data = await response.json();
        console.log(`[Mailer] ✅ Email sent via Brevo HTTP API! MessageId: ${data.messageId || "N/A"}`);
        return { messageId: data.messageId };
    }

    // 2. Try Resend HTTP API
    if (process.env.RESEND_API_KEY) {
        console.log(`[Mailer] Sending email to ${to} via Resend HTTP API (Port 443)...`);
        const senderEmail = process.env.RESEND_SENDER_EMAIL || "onboarding@resend.dev";
        const response = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${process.env.RESEND_API_KEY.trim()}`
            },
            body: JSON.stringify({
                from: `PingMe <${senderEmail.trim()}>`,
                to: [to],
                subject: subject,
                html: html
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Resend API returned status ${response.status}: ${errText}`);
        }

        const data = await response.json();
        console.log(`[Mailer] ✅ Email sent via Resend HTTP API! MessageId: ${data.id || "N/A"}`);
        return { messageId: data.id };
    }

    // 3. Try AWS SES HTTP API (Port 443, safe for Render free tier)
    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
        console.log(`[Mailer] Sending email to ${to} via AWS SES API...`);
        try {
            const { SESClient, SendEmailCommand } = require("@aws-sdk/client-ses");
            const ses = new SESClient({
                region: process.env.AWS_REGION || "us-east-1",
                credentials: {
                    accessKeyId: process.env.AWS_ACCESS_KEY_ID.trim(),
                    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY.trim(),
                },
            });
            const senderEmail = process.env.AWS_SES_SENDER || process.env.SMTP_USER || "support@pingsme.in";
            const command = new SendEmailCommand({
                Source: `PingMe <${senderEmail.trim()}>`,
                Destination: { ToAddresses: [to] },
                Message: {
                    Subject: { Data: subject },
                    Body: { Html: { Data: html } },
                },
            });
            const data = await ses.send(command);
            console.log(`[Mailer] ✅ Email sent via AWS SES! MessageId: ${data.MessageId}`);
            return { messageId: data.MessageId };
        } catch (sesErr) {
            throw new Error(`AWS SES API error: ${sesErr.message}`);
        }
    }

    // 4. Fallback to standard SMTP (which will work locally, or on paid cloud servers)
    console.log(`[Mailer] Sending email to ${to} via SMTP...`);
    const transporter = await getTransporter();
    const info = await transporter.sendMail({
        from: `"PingMe" <${(process.env.SMTP_USER || "").trim()}>`,
        to,
        subject,
        html,
    });
    console.log(`[Mailer] ✅ Email sent via SMTP! MessageId: ${info.messageId}`);
    return info;
};

/**
 * Send OTP email with a professional HTML template.
 */
const sendOTPEmail = async (to, username, otp) => {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>PingMe – Password Reset OTP</title>
</head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;background:#f4f4f4;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:40px 0;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.10);">

        <!-- Header -->
        <tr>
          <td style="background:#000;padding:32px 40px;text-align:center;">
            <table cellpadding="0" cellspacing="0" style="margin:0 auto 12px;">
              <tr>
                <td style="background:#fff;border-radius:12px;width:52px;height:52px;text-align:center;vertical-align:middle;">
                  <span style="font-size:28px;line-height:52px;">💬</span>
                </td>
              </tr>
            </table>
            <p style="margin:0;color:#fff;font-size:26px;font-weight:900;letter-spacing:4px;text-transform:uppercase;">PingMe</p>
            <p style="margin:6px 0 0;color:rgba(255,255,255,0.6);font-size:13px;">Secure Password Reset</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:40px;">
            <p style="margin:0 0 8px;font-size:20px;font-weight:700;color:#111;">Hi ${username},</p>
            <p style="margin:0 0 24px;font-size:15px;color:#555;line-height:1.6;">
              We received a request to reset your PingMe password. Use the OTP below to continue. It expires in <strong>10 minutes</strong>.
            </p>

            <!-- OTP Box -->
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="padding:28px 0;">
                  <table cellpadding="0" cellspacing="0">
                    <tr>
                      ${otp.split("").map(d => `
                      <td style="
                        width:52px;height:64px;
                        text-align:center;vertical-align:middle;
                        font-size:30px;font-weight:900;color:#000;
                        background:#f8f8f8;
                        border:2px solid #e0e0e0;
                        border-radius:10px;
                        margin:0 4px;
                        padding:0 4px;
                      ">${d}</td>
                      `).join("")}
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <p style="margin:0 0 24px;font-size:13px;color:#888;text-align:center;">
              Do not share this OTP with anyone. PingMe will never ask for it.
            </p>

            <hr style="border:none;border-top:1px solid #eee;margin:24px 0;"/>

            <p style="margin:0;font-size:13px;color:#aaa;text-align:center;">
              If you didn't request this, you can safely ignore this email. Your account is secure.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f8f8f8;padding:20px 40px;text-align:center;border-top:1px solid #eee;">
            <p style="margin:0;font-size:12px;color:#bbb;">© ${new Date().getFullYear()} PingMe. All rights reserved.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    console.log(`[Mailer] Preparing OTP email for: ${to}`);
    return await sendMailCustom({
        to,
        subject: `${otp} is your PingMe password reset OTP`,
        html,
    });
};

const sendFeedbackEmail = async (userEmail, username, rating, workingWell, needsChange) => {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>New Feedback Received</title>
</head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;background:#f4f4f4;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:40px 0;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.10);">
        <!-- Header -->
        <tr>
          <td style="background:#000;padding:24px 32px;text-align:center;">
            <p style="margin:0;color:#fff;font-size:22px;font-weight:900;letter-spacing:2px;text-transform:uppercase;">PingMe Feedback</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 16px;font-size:18px;font-weight:700;color:#111;">New Feedback Response</p>
            <table width="100%" style="border-collapse:collapse;margin-bottom:24px;">
              <tr style="border-bottom:1px solid #eee;">
                <td style="padding:10px 0;font-weight:600;color:#555;width:35%;">User:</td>
                <td style="padding:10px 0;color:#111;">${username} (${userEmail})</td>
              </tr>
              <tr style="border-bottom:1px solid #eee;">
                <td style="padding:10px 0;font-weight:600;color:#555;">Rating:</td>
                <td style="padding:10px 0;font-size:18px;color:#f39c12;">${"★".repeat(rating)}${"☆".repeat(5 - rating)} (${rating}/5)</td>
              </tr>
            </table>

            <div style="margin-bottom:20px;background:#f9f9f9;padding:16px;border-radius:8px;border-left:4px solid #2196F3;">
              <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#555;text-transform:uppercase;">What is working well:</p>
              <p style="margin:0;font-size:14px;color:#111;line-height:1.5;">${workingWell || "<em>No response provided</em>"}</p>
            </div>

            <div style="margin-bottom:8px;background:#f9f9f9;padding:16px;border-radius:8px;border-left:4px solid #f44336;">
              <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#555;text-transform:uppercase;">What needs to change / improve:</p>
              <p style="margin:0;font-size:14px;color:#111;line-height:1.5;">${needsChange || "<em>No response provided</em>"}</p>
            </div>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f8f8f8;padding:20px 40px;text-align:center;border-top:1px solid #eee;">
            <p style="margin:0;font-size:12px;color:#bbb;">© ${new Date().getFullYear()} PingMe support team.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    console.log(`[Mailer] Preparing Feedback email to supportpingmechat@gmail.com`);
    try {
        return await sendMailCustom({
            to: "supportpingmechat@gmail.com",
            subject: `Feedback from ${username} - ${rating}/5 Stars`,
            html,
        });
    } catch (err) {
        console.error("[Mailer] Failed to send feedback email:", err.message);
    }
};

const sendVerificationEmail = async (to, username, otp) => {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Verify your PingMe Email</title>
</head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;background:#f4f4f4;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:40px 0;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.10);">
        <!-- Header -->
        <tr>
          <td style="background:#000;padding:32px 40px;text-align:center;">
            <p style="margin:0;color:#fff;font-size:26px;font-weight:900;letter-spacing:4px;text-transform:uppercase;">PingMe</p>
            <p style="margin:6px 0 0;color:rgba(255,255,255,0.6);font-size:13px;">Email Verification</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:40px;">
            <p style="margin:0 0 8px;font-size:20px;font-weight:700;color:#111;">Welcome ${username}!</p>
            <p style="margin:0 0 24px;font-size:15px;color:#555;line-height:1.6;">
              Thank you for registering at PingMe. Please verify your email address by entering the 6-digit OTP code below. It is valid for <strong>10 minutes</strong>.
            </p>

            <!-- OTP Box -->
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="padding:28px 0;">
                  <table cellpadding="0" cellspacing="0">
                    <tr>
                      ${otp.split("").map(d => `
                      <td style="
                        width:42px;height:52px;
                        text-align:center;vertical-align:middle;
                        font-size:28px;font-weight:900;color:#000;
                        background:#f8f8f8;
                        border:2px solid #e0e0e0;
                        border-radius:10px;
                        margin:0 4px;
                        padding:0 4px;
                      ">${d}</td>
                      `).join("")}
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <hr style="border:none;border-top:1px solid #eee;margin:24px 0;"/>

            <p style="margin:0;font-size:13px;color:#aaa;text-align:center;">
              If you did not sign up for a PingMe account, please ignore this email.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f8f8f8;padding:20px 40px;text-align:center;border-top:1px solid #eee;">
            <p style="margin:0;font-size:12px;color:#bbb;">© ${new Date().getFullYear()} PingMe. All rights reserved.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    console.log(`[Mailer] Preparing verification email to: ${to}`);
    try {
        return await sendMailCustom({
            to,
            subject: `${otp} is your PingMe verification code`,
            html,
        });
    } catch (err) {
        console.error("[Mailer] Failed to send verification email:", err.message);
    }
};

module.exports = { sendOTPEmail, sendFeedbackEmail, sendVerificationEmail };
