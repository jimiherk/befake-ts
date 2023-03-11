import * as types from './types.ts';
import { download, existsSync } from './deps.ts';

export class BeFake {
    public token: string;
    public refreshToken: string;
    private apiUrl: string;
    private googleApiKey: string;
    private userAgent: string;
    private xIosBundleId: string;

    constructor(settings?: types.Settings) {
        this.apiUrl = settings?.apiUrl || 'https://mobile.bereal.com/api';
        this.googleApiKey = settings?.googleApiKey || 'AIzaSyDwjfEeparokD7sXPVQli9NsTuhT6fJ6iA';
        this.userAgent = settings?.userAgent || 'BeReal/0.25.1 (iPhone; iOS 16.0.2; Scale/2.00)';
        this.xIosBundleId = settings?.xIosBundleId || 'AlexisBarreyat.BeReal';

        this.token = '';
        this.refreshToken = '';
    }

    public async login(phoneNumber: string): Promise<void> {
        const otpResponse = await this.sendOtp(phoneNumber);

        if (!otpResponse.sessionInfo) {
            throw new Error(`No session info: ${otpResponse.error.message}`);
        }
        const otpCode = prompt('Enter OTP code');
        if (!otpCode) {
            throw new Error('No OTP code');
        }
        const otpVerificationResponse = await this.verifyOtp(otpCode, otpResponse.sessionInfo);
        if (!otpVerificationResponse.idToken || !otpVerificationResponse.refreshToken) {
            throw new Error('No id or refresh token');
        }
        this.token = otpVerificationResponse.idToken;
        this.refreshToken = otpVerificationResponse.refreshToken;
        return;
    }

    public tokenLogin(token: string) {
        this.token = token;
    }

    private async sendOtp(phoneNumber: string) {
        const url = new URL('https://www.googleapis.com/identitytoolkit/v3/relyingparty/sendVerificationCode');
        url.searchParams.append('key', this.googleApiKey);

        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'user-agent': this.userAgent,
                'x-ios-bundle-identifier': this.xIosBundleId,
            },
            body: JSON.stringify({
                phoneNumber: phoneNumber,
                iosReceipt: 'AEFDNu9QZBdycrEZ8bM_2-Ei5kn6XNrxHplCLx2HYOoJAWx-uSYzMldf66-gI1vOzqxfuT4uJeMXdreGJP5V1pNen_IKJVED3EdKl0ldUyYJflW5rDVjaQiXpN0Zu2BNc1c',
            })
        });

        return await res.json();
    }

    private async verifyOtp(otpCode: string, otpSession: string) {
        if (!otpCode) {
            throw new Error('No OTP code');
        }
        if (!otpSession) {
            throw new Error('No OTP session');
        }
        const url = new URL('https://www.googleapis.com/identitytoolkit/v3/relyingparty/verifyPhoneNumber');
        url.searchParams.append('key', this.googleApiKey);

        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'user-agent': this.userAgent,
                'x-ios-bundle-identifier': this.xIosBundleId,
            },
            body: JSON.stringify({
                sessionInfo: otpSession,
                code: otpCode,
                operation: 'SIGN_UP_OR_IN'
            })
        });

        return await res.json();
    }

    public getFriendsFeed() {
        fetch(`${this.apiUrl}/feeds/friends`, {
            method: 'GET',
            headers: {
                'user-agent': this.userAgent,
                'x-ios-bundle-identifier': this.xIosBundleId,
                'authorization': this.token
            }
        }).then(res => res.json()).then(data => {
            for (const post of data) {
                if (!existsSync(`users/${post.userName}/`)) Deno.mkdirSync(`users/${post.userName}`);
                Deno.mkdirSync(`users/${post.userName}/${post.id}`);
                download(post.photoURL, { dir: `users/${post.userName}/${post.id}`, file: `primary.webp` });
                download(post.secondaryPhotoURL, { dir: `users/${post.userName}/${post.id}`, file: `secondary.webp` });

                Deno.writeTextFileSync(`users/${post.userName}/${post.id}/info.json`, JSON.stringify(post));

                Deno.mkdirSync(`users/${post.userName}/${post.id}/realmojis`)
                for (const realmoji of post.realMojis) {
                    if (!realmoji.uri) continue;
                    if (!existsSync(`users/${post.userName}/${post.id}/realmojis/${realmoji.emoji}`)) Deno.mkdirSync(`users/${post.userName}/${post.id}/realmojis/${realmoji.emoji}`);
                    download(realmoji.uri, { dir: `users/${post.userName}/${post.id}/realmojis/${realmoji.emoji}`, file: `${realmoji.userName}.webp` });
                }
            }
        });
    }

    public async getFriends(): Promise<types.User[]> {
        const res = await fetch(`${this.apiUrl}/relationships/friends`, {
            method: 'GET',
            headers: {
                'user-agent': this.userAgent,
                'x-ios-bundle-identifier': this.xIosBundleId,
                'authorization': this.token
            }
        });
        const data = await res.json();
        const friends: types.User[] = [];
        for (const user of data.data) {
            if (user.status !== 'accepted') continue;
            if (!(user.username && user.id && user.fullname)) {
                console.warn(`Missing data for user ${user.userName}`);
                console.log(user);
                continue;
            }
            let friendObject: types.User = {
                id: user.id,
                username: user.username,
                name: user.fullname
            };
            if (user.profilePicture) {
                friendObject.profilePicture = user.profilePicture.url;
            }
            friends.push(friendObject);
        }
        return friends;
    }
}