type WhatsAppCloudMessageResponse = {
  messages?: Array<{
    id?: string;
  }>;
};

function readEnv(name: string) {
  return process.env[name]?.trim() ?? "";
}

function getWhatsAppCloudConfig() {
  const accessToken = readEnv("WHATSAPP_CLOUD_ACCESS_TOKEN");
  const phoneNumberId = readEnv("WHATSAPP_CLOUD_PHONE_NUMBER_ID");
  const templateName = readEnv("WHATSAPP_CLOUD_TEMPLATE_NAME");
  const templateLanguage = readEnv("WHATSAPP_CLOUD_TEMPLATE_LANGUAGE") || "en_US";
  const apiVersion = readEnv("WHATSAPP_CLOUD_API_VERSION") || "v21.0";
  const includeCopyCodeButton = readEnv("WHATSAPP_CLOUD_TEMPLATE_INCLUDE_BUTTON_CODE").toLowerCase() === "true";

  if (!accessToken || !phoneNumberId || !templateName) {
    throw new Error(
      "WhatsApp sending is not configured. Add WHATSAPP_CLOUD_ACCESS_TOKEN, WHATSAPP_CLOUD_PHONE_NUMBER_ID, and WHATSAPP_CLOUD_TEMPLATE_NAME to .env."
    );
  }

  return {
    accessToken,
    phoneNumberId,
    templateName,
    templateLanguage,
    apiVersion,
    includeCopyCodeButton
  };
}

function toWhatsAppRecipient(phoneNumber: string) {
  return phoneNumber.replace(/\D/g, "");
}

export async function sendWhatsAppVerificationCode(input: {
  phoneNumber: string;
  code: string;
  expiresInMinutes: number;
}) {
  const config = getWhatsAppCloudConfig();
  const components: Array<Record<string, unknown>> = [
    {
      type: "body",
      parameters: [
        {
          type: "text",
          text: input.code
        }
      ]
    }
  ];

  if (config.includeCopyCodeButton) {
    components.push({
      type: "button",
      sub_type: "url",
      index: "0",
      parameters: [
        {
          type: "text",
          text: input.code
        }
      ]
    });
  }

  const response = await fetch(
    `https://graph.facebook.com/${encodeURIComponent(config.apiVersion)}/${encodeURIComponent(config.phoneNumberId)}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: toWhatsAppRecipient(input.phoneNumber),
        type: "template",
        template: {
          name: config.templateName,
          language: {
            code: config.templateLanguage
          },
          components
        }
      })
    }
  );

  const payload = (await response.json().catch(() => null)) as
    | (WhatsAppCloudMessageResponse & {
        error?: {
          message?: string;
        };
      })
    | null;

  if (!response.ok) {
    const message = payload?.error?.message || "WhatsApp Cloud API rejected the verification message.";
    throw new Error(message);
  }

  return {
    provider: "whatsapp_cloud",
    messageId: payload?.messages?.[0]?.id ?? null
  };
}
