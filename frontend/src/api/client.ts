import axios from "axios";
import type { LoginResponse, TwoFactorRequiredResponse } from "../types";

// const API_BASE_URL = 'http://192.168.1.56:3000/api/v1';
const API_BASE_URL = '/api/v1';

const apiClient = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json'
    }
})

apiClient.interceptors.request.use((config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
},
    (error) => {
        // Handle request errors
        console.error('Request error:', error);
        return Promise.reject(error);
    })


// Response interceptor - Handle errors
// Response interceptor - Handle errors and auto-refresh
apiClient.interceptors.response.use(
    (response) => {
        return response;
    },
    async (error) => {
        const originalRequest = error.config;

        // Handle 401 errors
        if (error.response?.status === 401 && !originalRequest._retry) {
            const hasToken = localStorage.getItem('accessToken');
            
            if (hasToken) {
                // Token expired - try to refresh
                originalRequest._retry = true;
                
                try {
                    const refreshToken = localStorage.getItem('refreshToken');
                    
                    if (!refreshToken) {
                        // No refresh token - redirect to login
                        localStorage.clear();
                        window.location.href = '/login';
                        return Promise.reject(error);
                    }
                    
                    // Call refresh endpoint
                    const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
                        refreshToken
                    });
                    
                    // Save new tokens
                    localStorage.setItem('accessToken', response.data.accessToken);
                    localStorage.setItem('refreshToken', response.data.refreshToken);
                    
                    // Update Authorization header
                    originalRequest.headers.Authorization = `Bearer ${response.data.accessToken}`;
                    
                    // Retry original request with new token
                    return apiClient(originalRequest);
                    
                } catch (refreshError) {
                    // Refresh failed - redirect to login
                    localStorage.clear();
                    window.location.href = '/login';
                    return Promise.reject(refreshError);
                }
            }
        }

        if (error.response?.status === 403) {
            console.error('Access forbidden');
        }

        if (error.response?.status === 429) {
            console.error('Too many requests');
        }

        if (error.request && !error.response) {
            console.error('Network error - backend may be down');
        }

        return Promise.reject(error);
    }
);


export const authAPI = {
    //Login
    async login(email: string, password: string): Promise<LoginResponse | TwoFactorRequiredResponse> {
        const response = await apiClient.post('/auth/login', { email, password })
        return response.data
    },
    // Verify 2FA
    async verify2FA(email: string, token: string): Promise<LoginResponse> {
        const response = await apiClient.post('/auth/verify-2fa', { email, token });
        return response.data;
    },
      // Setup 2FA (generate secret and QR code)
    async setup2FA() {
        const response = await apiClient.post('/auth/setup-2fa');
        return response.data;
    },
 
    // Enable 2FA (after setup)
    async enable2FA(token: string) {
        const response = await apiClient.post('/auth/enable-2fa', { token });
        return response.data;
    },
 
    // Disable 2FA
    async disable2FA(token: string) {
        const response = await apiClient.post('/auth/disable-2fa', { token });
        return response.data;
    },
      async register(username: string, email: string, password: string, role: 'admin' | 'user', storageQuota: number | null) {
        const response = await apiClient.post('/auth/register', {
            username,
            email,
            password,
            role,
            storage_quota: storageQuota
        });
        return response.data;
    },
     async refresh(refreshToken: string) {
        const response = await apiClient.post('/auth/refresh', {
            refreshToken
        });
        return response.data;
    }
}


export const folderAPI = {
    async getTree() {
        const response = await apiClient.get('/folders/tree')
        return response.data
    },
    async create(name: string, parentFolderId: string | null){
        const response = await apiClient.post('/folders', {
            name,
            parent_folder_id: parentFolderId
        })
        return response.data;

    },
    // Get trashed folders
    async getTrash() {
        const response = await apiClient.get('/folders/trash');
        return response.data;
    },
 
    // Restore folder from trash
    async restore(folderId: string) {
        const response = await apiClient.post(`/folders/${folderId}/restore`);
        return response.data;
    },
    // Delete folder (soft delete)
    async delete(folderId: string) {
        const response = await apiClient.delete(`/folders/${folderId}`);
        return response.data;
    },
     async rename(folderId: string, newName: string) {
        const response = await apiClient.put(`/folders/${folderId}`, {
            name: newName
        });
        return response.data;
    },
    async makePublic(folderId: string, slug: string) {
    const response = await apiClient.put(`/folders/${folderId}/public`, { slug });
    return response.data;
},
async makePrivate(folderId: string) {
    const response = await apiClient.delete(`/folders/${folderId}/public`);
    return response.data;
}
}

export const fileAPI = {
    async download(fileId: string) {
        const response = await apiClient.get(`/files/${fileId}/download`, {
            responseType: 'blob'
        })
        return response.data;
    },
     async upload(file: File, folderId: string | null) {
        const formData = new FormData();
        formData.append('file', file);
        if (folderId) {
            formData.append('folder_id', folderId);
        }
 
        const response = await apiClient.post('/files/upload', formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        });
        return response.data;
    },
     async delete(fileId: string) {
        const response = await apiClient.delete(`/files/${fileId}`);
        return response.data;
    },

    async uploadInit(filename: string, fileSize: number, fileHash: string, mimeType: string, totalChunks: number, folderId: string | null){
        const response = await apiClient.post('/files/upload/init',{
            filename,
            file_size: fileSize,
            file_hash: fileHash,
            mime_type: mimeType,
            total_chunks: totalChunks,
            folder_id: folderId
        })
        return response.data;
    },
    async uploadChunk(sessionId: string, chunkIndex: number, chunkBlob: Blob){
        const formData = new FormData();
        formData.append('upload_session_id', sessionId);
        formData.append('chunk_index', chunkIndex.toString());
        formData.append('chunk', chunkBlob);

        const response = await apiClient.post('/files/upload/chunk', formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        });
        return response.data;
    },
    // Chunked upload - Complete
    async uploadComplete(sessionId: string, fileHash: string) {
        const response = await apiClient.post('/files/upload/complete', {
            upload_session_id: sessionId,
            file_hash: fileHash
        });
        return response.data;
    },
    // Get upload status
    async uploadStatus(sessionId: string) {
        const response = await apiClient.get(`/files/upload/status/${sessionId}`);
        return response.data;
    },
    async checkDuplicate(fileHash: string, fileSize: number, filename: string, mimeType: string, folderId: string | null) {
        const response = await apiClient.post('/files/check-duplicate', {
            file_hash: fileHash,
            file_size: fileSize,
            filename: filename,
            mime_type: mimeType,
            folder_id: folderId
        });
        return response.data;
    },
        // Get trashed files
    async getTrash(page: number = 1, limit: number = 50) {
        const response = await apiClient.get('/files/trash', {
            params: { page, limit }
        });
        return response.data;
    },
 
    // Restore file from trash
    async restore(fileId: string) {
        const response = await apiClient.post(`/files/${fileId}/restore`);
        return response.data;
    },
 
    // Permanently delete file
    async permanentDelete(fileId: string) {
        const response = await apiClient.delete(`/files/${fileId}/permanent`);
        return response
    },
     async move(fileId: string, targetFolderId: string | null) {
        const response = await apiClient.put(`/files/${fileId}/move`, {
            folder_id: targetFolderId
        });
        return response.data;
    },
     async getFiles(page: number = 1, limit: number = 100) {
        const response = await apiClient.get('/files', {
            params: { page, limit }
        });
        return response.data;
    },
    async getThumbnail(fileId: string): Promise<Blob> {
    const response = await apiClient.get(`/files/${fileId}/thumbnail`, {
        responseType: 'blob'
    });
    return response.data;
    }

}
export const userAPI = {
    async getAll(page: number = 1, limit: number = 50) {
        const response = await apiClient.get('/users', { params: { page, limit } });
        return response.data;
    },
    async getById(userId: string) {
        const response = await apiClient.get(`/users/${userId}`);
        return response.data;
    },
    async updateQuota(userId: string, storageQuota: number | null) {
        const response = await apiClient.put(`/users/${userId}/quota`, {
            storage_quota: storageQuota
        });
        return response.data;
    },
    async deactivate(userId: string) {
        const response = await apiClient.delete(`/users/${userId}`);
        return response.data;
    },
    async restore(userId: string) {
        const response = await apiClient.post(`/users/${userId}/restore`);
        return response.data;
    },
    async permanentDelete(userId: string) {
        const response = await apiClient.delete(`/users/${userId}/permanent`, {
            data: { confirm: true }
        });
        return response.data;
    },
    async triggerCleanup() {
        const response = await apiClient.post('/users/cleanup');
        return response.data;
    },
        async getMe() {
    const response = await apiClient.get('/users/me');
    return response.data;
},
    
}

export const publicFolderAPI = {
    async getAll() {
        const response = await apiClient.get('/public/folders');
        return response.data;
    },
    async getBySlug(slug: string) {
        const response = await apiClient.get(`/public/folders/${slug}`);
        return response.data;
    },
    getThumbnailUrl(slug: string, fileId: string): string {
        return `${API_BASE_URL}/public/folders/${slug}/files/${fileId}/thumbnail`;
    },
    getDownloadUrl(slug: string, fileId: string): string {
        return `${API_BASE_URL}/public/folders/${slug}/files/${fileId}/download`;
    },

}
export default apiClient;
