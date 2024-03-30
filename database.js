const sqlite = require("sqlite3");
const {supabase} = require('./supabaseClient.js');

class Users {
    static tableName = 'users';
    static async addUser(username, password, email, pfp, admin, verified) {
        const res = await supabase.from(this.tableName).insert([{ username, password, email, pfp, admin, verified, timestamp: new Date().getTime() }]).select('*');
        return res.data[0];

    }
    static async login(email, password) {
        var res = await supabase.from(this.tableName).select('*').eq('email', email).eq('password', password);
        if (res.error) return null;
        return res.data[0];
    }
    static async getUserById(id) {
        try {
            const res = await supabase.from(this.tableName).select('*').eq('id', id);
            if (res.error || res.data.length === 0) {
                throw new Error('User not found');
            }
            return res.data[0];
        } catch (error) {
            console.error(error);
            return null;
        }
    }
    static async getUserByEmail(email) {
        try {
            const res = await supabase.from(this.tableName).select('*').eq('email', email);
            if (res.error || res.data.length === 0) {
                throw new Error('User not found');
            }
            return res.data[0];
        } catch (error) {
            console.error(error);
            return null;
        }
    }
    static async getUserByUsername(username) {
        try {
            const res = await supabase.from(this.tableName).select('*').eq('username', username);
            if (res.error || res.data.length === 0) {
                throw new Error('User not found');
            }
            return res.data[0];
        } catch (error) {
            console.error(error);
            return null;
        }
    }
    static async getVerifiedUsers() {
        try {
            const res = await supabase.from(this.tableName).select('*').eq('verified', true);
            if (res.error) {
                throw new Error('Failed to fetch verified users');
            }
            return res.data || [];
        } catch (error) {
            console.error(error);
            return [];
        }
    }
    static async isUserVerified(id) {
        try {
            const res = await supabase.from(this.tableName).select('verified').eq('id', id);
            if (res.error || res.data.length === 0) {
                throw new Error('User not found');
            }
            return res.data[0].verified;
        } catch (error) {
            console.error(error);
            return false;
        }
    }
    static async getRowsByField(field, value) {
        try {
            return (await supabase.from(this.tableName).select('*').eq(field, value)).data || [];
        } catch (error) {
            console.error(error);
            return [];
        }
    }
}
class Images {
    static tableName = 'images';
    static async addImage(creatorID, width, height, title, nameRequired, loggedInRequired, verifiedRequired, filterBadWords) {
        try {
            var res = await supabase.from(this.tableName).insert([{ creatorID, width, height, title,nameRequired, loggedInRequired, verifiedRequired, filterBadWords }]).select('id');
            console.log(res);
            return res.data[0].id;
        } catch (error) {
            console.error(error);
            return null;
        }
    }
    static async getImagesByuserID(userID) {
        try {
            var res = await supabase.from(this.tableName).select('*').eq('creatorID', userID);
            if (res.error) {
                throw new Error('Failed to fetch images');
            }
            return res.data;
        } catch (error) {
            console.error(error);
            return [];
        }
    }
    static async getImageById(id) {
        try {
            var res = await supabase.from(this.tableName).select('*').eq('id', id);
            if (res.error || res.data.length === 0) {
                throw new Error('Image not found');
            }
            return res.data[0];
        } catch (error) {
            console.error(error);
            return null;
        }
    }
    static async getRowsByField(field, value) {
        try {
            return (await supabase.from(this.tableName).select('*').eq(field, value)).data || [];
        } catch (error) {
            console.error(error);
            return [];
        }
    }
}
class Comments {
    static tableName = 'comments';
    static async addComment(userID, comment, imageID, authorName, replyTo = null) {
        try {
            var res = await supabase.from(this.tableName).insert([{ creatorID: userID, comment, imageID, replyTo, authorName }]).select('id');
            console.log(res);
            return res.data[0].id;
        } catch (error) {
            console.error(error);
            return null;
        }
    }
    static async getCommentsByuserID(userID) {
        try {
            return (await supabase.from(this.tableName).select('*').eq('creatorID', userID)).data || [];
        } catch (error) {
            console.error(error);
            return [];
        }
    }
    static async getCommentsByImage(imageID){
        try {
            return (await supabase.from(this.tableName).select('*').eq('imageID', imageID)).data || [];
        } catch (error) {
            console.error(error);
            return [];
        }
    }
    static async getRowsByField(field, value) {
        try {
            return (await supabase.from(this.tableName).select('*').eq(field, value)).data || [];
        } catch (error) {
            console.error(error);
            return [];
        }
    }
}
module.exports = { Users, Images, Comments }
