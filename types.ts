export interface Settings {
    apiUrl?: string;
    googleApiKey?: string;
    userAgent?: string;
    xIosBundleId?: string;
}

export interface User {
    id: string;
    name: string;
    username: string;
    profilePicture?: string;
}