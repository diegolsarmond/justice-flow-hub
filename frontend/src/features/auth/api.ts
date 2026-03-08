import { supabase } from "@/lib/supabase";
import { fetchUserProfile } from "./profileService";
import type { AuthUser, LoginCredentials, LoginResponse } from "./types";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export const loginRequest = async (
  credentials: LoginCredentials,
): Promise<LoginResponse> => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: credentials.email,
    password: credentials.senha,
  });

  if (error) {
    if (error.message?.includes("Email not confirmed")) {
      throw new ApiError(
        "Confirme seu e-mail antes de acessar. Verifique sua caixa de entrada.",
        403,
      );
    }
    throw new ApiError(
      error.message || "Credenciais inválidas. Verifique seu e-mail e senha.",
      401,
    );
  }

  if (!data.session || !data.user) {
    throw new Error("Resposta de autenticação inválida.");
  }

  const profile = await fetchUserProfile(data.user.id);
  if (!profile) {
    throw new Error("Perfil de usuário não encontrado.");
  }

  return {
    token: data.session.access_token,
    refreshToken: data.session.refresh_token,
    expiresIn: data.session.expires_in,
    user: profile,
  };
};

export const fetchCurrentUser = async (_token?: string): Promise<AuthUser> => {
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    throw new ApiError("Sessão expirada.", 401);
  }

  const profile = await fetchUserProfile(user.id);
  if (!profile) {
    throw new Error("Não foi possível carregar os dados do usuário.");
  }

  return profile;
};

export const refreshTokenRequest = async (
  _token: string,
): Promise<{ token: string; refreshToken?: string; expiresIn?: number }> => {
  const { data, error } = await supabase.auth.refreshSession();

  if (error || !data.session) {
    throw new ApiError("Resposta de renovação inválida.", 401);
  }

  return {
    token: data.session.access_token,
    refreshToken: data.session.refresh_token,
    expiresIn: data.session.expires_in,
  };
};

export interface ChangePasswordPayload {
  temporaryPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export const changePasswordRequest = async (
  payload: ChangePasswordPayload,
): Promise<{ message: string }> => {
  const { error } = await supabase.auth.updateUser({
    password: payload.newPassword,
  });

  if (error) {
    throw new ApiError(error.message || "Falha ao atualizar senha.", 400);
  }

  return { message: "Senha atualizada com sucesso." };
};

export const requestPasswordReset = async (
  email: string,
): Promise<{ message: string }> => {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });

  if (error) {
    throw new ApiError(error.message, 400);
  }

  return {
    message: "Se o e-mail informado estiver cadastrado, enviaremos as instruções para redefinir a senha.",
  };
};

export const resendEmailConfirmationRequest = async (email: string): Promise<string> => {
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
  });

  if (error) {
    throw new ApiError(error.message, 400);
  }

  return "Um novo e-mail de confirmação foi enviado.";
};

export const confirmEmailRequest = async (
  _token: string,
  _signal?: AbortSignal,
): Promise<{ message: string; confirmedAt?: string }> => {
  // Supabase handles email confirmation via URL redirect automatically.
  // This function is kept for API compatibility.
  return { message: "E-mail confirmado com sucesso." };
};

export const signUpRequest = async (params: {
  email: string;
  password: string;
  nome: string;
  empresa?: string;
  telefone?: string;
  planId?: number;
}): Promise<{ message: string }> => {
  const { error } = await supabase.auth.signUp({
    email: params.email,
    password: params.password,
    options: {
      data: {
        nome: params.nome,
        name: params.nome,
        telefone: params.telefone,
        empresa: params.empresa,
        planId: params.planId,
      },
      emailRedirectTo: window.location.origin,
    },
  });

  if (error) {
    throw new ApiError(error.message || "Falha ao criar conta.", 400);
  }

  return {
    message: "Conta criada com sucesso! Verifique seu e-mail para confirmar.",
  };
};
