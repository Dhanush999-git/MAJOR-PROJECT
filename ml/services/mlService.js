import dotenv from "dotenv";

dotenv.config();

const ML_API_URL =
  process.env.ML_API_URL || "http://127.0.0.1:8000";

async function parseResponse(response) {
  const contentType =
    response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  const text = await response.text();

  return {
    detail: text || "ML service returned an invalid response.",
  };
}

export async function verifyText(text) {
  if (
    typeof text !== "string" ||
    !text.trim()
  ) {
    throw new Error("Text cannot be empty.");
  }

  const response = await fetch(
    `${ML_API_URL}/verify/text`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: text.trim(),
      }),
    }
  );

  const data = await parseResponse(response);

  if (!response.ok) {
    const message =
      typeof data?.detail === "string"
        ? data.detail
        : "Text verification failed.";

    throw new Error(message);
  }

  return data;
}

export async function checkMLHealth() {
  const response = await fetch(
    `${ML_API_URL}/health`,
    {
      method: "GET",
    }
  );

  const data = await parseResponse(response);

  if (!response.ok) {
    throw new Error(
      "ML service health check failed."
    );
  }

  return data;
}