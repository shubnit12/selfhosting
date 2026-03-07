// User types
export interface User {
    id: string;
    username: string;
    email: string;
    role: 'admin' | 'user';
    storage_quota: number | null;
    storage_used: number;
    two_fa_enabled: boolean;
}

// File types
export interface File {
    id: string;
    original_name: string;
    size: number;
    mime_type: string;
    created_at: string;
    folder_id: string | null;
}

// Folder types
export interface Folder {
    id: string;
    name: string;
    path: string;
    parent_folder_id: string | null;
    created_at: string;
}

// Auth response types
export interface LoginResponse {
    message: string;
    accessToken: string;
    refreshToken: string;
    user: User;
}

export interface TwoFactorRequiredResponse {
    requires2FA: true;
    message: string;
    userId: string;
}