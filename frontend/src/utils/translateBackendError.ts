type ContextoErro = "register" | "login" | "default"

export function translateBackendError(json: any, contexto: ContextoErro = "default"): string {
  const code = typeof json?.code === "string" ? json.code : undefined
  const rawMessage = typeof json?.message === "string" ? json.message : ""
  const data = json?.data

  // 1) Trata por código (StatusCodeDescription do backend)
  if (code === "INVALID_CREDENTIALS") {
    return "CPF ou senha inválidos."
  }

  if (code === "USER_EXISTS") {
    return "Já existe um usuário cadastrado com esse CPF ou e-mail."
  }

  if (code === "USER_NOT_FOUND") {
    return "Usuário não encontrado."
  }

  if (code === "INVALID_REFRESH_TOKEN") {
    return "Sessão expirada ou inválida. Faça login novamente."
  }

  if (code === "INVALID_INPUT") {
    // se o backend mandou a lista do Joi em data
    if (Array.isArray(data) && data.length > 0) {
      const first = String(data[0])
      const lower = first.toLowerCase()

      if (lower.includes("cpf")) {
        return "Verifique o CPF informado."
      }
      if (lower.includes("email") || lower.includes("e-mail")) {
        return "E-mail inválido. Informe um e-mail válido."
      }

      return first
    }

    if (contexto === "register") {
      return "Dados inválidos. Verifique os campos do cadastro."
    }

    return "Dados inválidos. Verifique as informações enviadas."
  }

  // 2) Heurísticas por mensagem em inglês (fallback)
  const msg = rawMessage.toLowerCase()

  // casos típicos de duplicidade / usuário existente
  if (
    msg.includes("user exists") ||
    msg.includes("user already exists") ||
    msg.includes("user with this") ||
    msg.includes("already in use")
  ) {
    return "Já existe um usuário cadastrado com esses dados (CPF ou e-mail)."
  }

  if (msg.includes("unique constraint") || msg.includes("duplicate")) {
    return "Email ou CPF já está em uso."
  }

  if (msg.includes("must be a valid email")) {
    return "E-mail inválido. Informe um e-mail válido."
  }

  if (msg.includes("is required")) {
    return "Existem campos obrigatórios não preenchidos. Verifique o formulário."
  }

  if (msg.includes("invalid cpf")) {
    return "CPF inválido."
  }

  if (msg.includes("password") && msg.includes("length")) {
    return "A senha não atende aos requisitos mínimos."
  }

  // 3) Se vier alguma mensagem legível do backend, usa ela
  // (mas agora só depois de tentar mapear os casos mais comuns em inglês)
  if (rawMessage) {
    return rawMessage
  }

  // 4) Fallback por contexto
  if (contexto === "register") {
    return "Não foi possível concluir o cadastro. Verifique os dados e tente novamente."
  }

  if (contexto === "login") {
    return "Não foi possível realizar o login. Tente novamente."
  }

  return "Ocorreu um erro ao processar sua solicitação."
}
