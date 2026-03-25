export async function callClaude(prompt) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1800,
      temperature: 0.3,
      messages: [
        {
          role: "user",
          content: prompt
        }
      ]
    })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error?.message || "Erro ao chamar Claude");
  }

  const text = data?.content?.find((item) => item.type === "text")?.text;

  if (!text) {
    throw new Error("Resposta vazia do Claude");
  }

  return text;
}
