import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';
import User from './User';
import File from './File';
import Folder from './Folder';
import SharedLink from './SharedLink';

// ========================================
// ENUM: Action Types
// ========================================
export enum ActivityAction {
    // File actions
    UPLOAD = 'upload',
    DOWNLOAD = 'download',
    DELETE = 'delete',
    SHARE = 'share',
    VIEW = 'view',
    RESTORE = 'restore',
    MOVE_FILE = 'move_file',

    // Folder actions
    CREATE_FOLDER = 'create_folder',
    RENAME_FOLDER = 'rename_folder',
    MOVE_FOLDER = 'move_folder',
    DELETE_FOLDER = 'delete_folder',
    RESTORE_FOLDER = 'restore_folder',

    // SharedLink actions
    SHARE_LINK_CREATED = 'share_link_created',
    SHARE_LINK_ACCESSED = 'share_link_accessed',
    SHARE_LINK_DOWNLOADED = 'share_link_downloaded',
    SHARE_LINK_PASSWORD_FAILED = 'share_link_password_failed',
    SHARE_LINK_DEACTIVATED = 'share_link_deactivated',

    // User actions
    CREATE_USER = 'create_user',
    LOGIN = 'login',
    LOGOUT = 'logout',
    ENABLE_2FA = 'enable_2fa',
    DISABLE_2FA = 'disable_2fa'
}

// ========================================
// INTERFACE: ActivityLog Attributes
// ========================================
interface ActivityLogAttributes {
    id: number;
    user_id: string | null;
    file_id: string | null;
    folder_id: string | null;
    shared_link_id: string | null;
    action: ActivityAction;
    ip_address: string | null;
    user_agent: string | null;
    details: object | null;
    created_at?: Date;
}

// ========================================
// INTERFACE: Creation Attributes
// ========================================
interface ActivityLogCreationAttributes extends Optional<
    ActivityLogAttributes,
    'id' | 'user_id' | 'file_id' | 'folder_id' | 'shared_link_id' | 'ip_address' | 'user_agent' | 'details' | 'created_at'
> {}

// ========================================
// CLASS: ActivityLog Model
// ========================================
class ActivityLog extends Model<
    ActivityLogAttributes,
    ActivityLogCreationAttributes
> implements ActivityLogAttributes {
    public id!: number;
    public user_id!: string | null;
    public file_id!: string | null;
    public folder_id!: string | null;
    public shared_link_id!: string | null;
    public action!: ActivityAction;
    public ip_address!: string | null;
    public user_agent!: string | null;
    public details!: object | null;
    public readonly created_at!: Date;
    public user?: User;
    public file?: File;
    public folder?: Folder; 
    public sharedLink?: SharedLink;

    // ========================================
    // HELPER METHOD: Create Log Entry
    // ========================================
    
    /**
     * Convenience method to create activity log
     */
    public static async log(
        action: ActivityAction,
        options: {
            userId?: string;
            fileId?: string;
            folderId?: string;
            sharedLinkId?: string;
            ipAddress?: string;
            userAgent?: string;
            details?: object;
        } = {}
    ): Promise<ActivityLog> {
        return await ActivityLog.create({
            action,
            user_id: options.userId || null,
            file_id: options.fileId || null,
            folder_id: options.folderId || null,
            shared_link_id: options.sharedLinkId || null,
            ip_address: options.ipAddress || null,
            user_agent: options.userAgent || null,
            details: options.details || null
        });
    }
}

// ========================================
// INITIALIZE: Model Definition
// ========================================
ActivityLog.init(
    {
        id: {
            type: DataTypes.BIGINT,
            autoIncrement: true,
            primaryKey: true,
            comment: 'Auto-incrementing ID (can handle millions of logs)'
        },
        user_id: {
            type: DataTypes.UUID,
            allowNull: true,
            references: {
                model: 'users',
                key: 'id'
            },
            onUpdate: 'CASCADE',
            onDelete: 'SET NULL',  // ✅ Keep logs for audit (user can be null)
            comment: 'User who performed action (null for public/anonymous access)'
        },
        file_id: {
            type: DataTypes.UUID,
            allowNull: true,
            references: {
                model: 'files',
                key: 'id'
            },
            onUpdate: 'CASCADE',
            onDelete: 'SET NULL',  // ✅ Keep logs even if file deleted
            comment: 'File related to action (null for non-file actions like login)'
        },
        action: {
            type: DataTypes.ENUM(...Object.values(ActivityAction)),
            allowNull: false,
            comment: 'Type of action performed'
        },
        ip_address: {
            type: DataTypes.STRING(45), // IPv6 max length
            allowNull: true,
            comment: 'IP address of request'
        },
        user_agent: {
            type: DataTypes.TEXT,
            allowNull: true,
            comment: 'Browser/client user agent string'
        },
        details: {
            type: DataTypes.JSONB,
            allowNull: true,
            comment: 'Additional context (e.g., error messages, file names, etc.)'
        },
         folder_id: {
            type: DataTypes.UUID,
            allowNull: true,
            references: {
                model: 'folders',
                key: 'id'
            },
            onUpdate: 'CASCADE',
            onDelete: 'SET NULL',  // ✅ Keep logs even if folder deleted
            comment: 'Folder related to action (null for non-folder actions)'
        },
         shared_link_id: {
            type: DataTypes.UUID,
            allowNull: true,
            references: {
                model: 'shared_links',
                key: 'id'
            },
            onUpdate: 'CASCADE',
            onDelete: 'SET NULL',  // ✅ Keep logs even if link deleted
            comment: 'SharedLink related to action (for tracking public access)'
        },
    },
    {
        sequelize,
        tableName: 'activity_logs',
        underscored: true,
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: false, // Logs never update, only created
        indexes: [
            { fields: ['user_id'] },
            { fields: ['file_id'] },
            { fields: ['folder_id'] },
            { fields: ['shared_link_id'] },
            { fields: ['action'] },
            { fields: ['created_at'] },
            { fields: ['ip_address'] },
            {
                // Composite index for common query: user's recent actions
                fields: ['user_id', 'created_at']
            }
        ]
    }
);

export default ActivityLog;