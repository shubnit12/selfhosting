import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';
import crypto from 'crypto';
import User from './User';
import File from './File'
import ActivityLog from './ActivityLog';

// ========================================
// INTERFACE: SharedLink Attributes
// ========================================
interface SharedLinkAttributes {
    id: string;
    file_id: string;
    created_by_user_id: string;
    token: string;
    password_hash: string | null;
    expires_at: Date | null;
    max_downloads: number | null;
    download_count: number;
    allow_preview: boolean;
    is_active: boolean;
    created_at?: Date;
    last_accessed_at: Date | null;
}

// ========================================
// INTERFACE: Creation Attributes
// ========================================
interface SharedLinkCreationAttributes extends Optional<
    SharedLinkAttributes,
    'id' | 'password_hash' | 'expires_at' | 'max_downloads' | 
    'download_count' | 'allow_preview' | 'is_active' | 
    'created_at' | 'last_accessed_at'
> {}

// ========================================
// CLASS: SharedLink Model
// ========================================
class SharedLink extends Model<
    SharedLinkAttributes,
    SharedLinkCreationAttributes
> implements SharedLinkAttributes {
    public id!: string;
    public file_id!: string;
    public created_by_user_id!: string;
    public token!: string;
    public password_hash!: string | null;
    public expires_at!: Date | null;
    public max_downloads!: number | null;
    public download_count!: number;
    public allow_preview!: boolean;
    public is_active!: boolean;
    public readonly created_at!: Date;
    public last_accessed_at!: Date | null;
    public file?: File;
    public creator?: User;
    public activityLogs?: ActivityLog[];

    // ========================================
    // HELPER METHODS
    // ========================================

    /**
     * Check if share link is expired
     */
    public isExpired(): boolean {
        if (!this.expires_at) return false;
        return new Date() > this.expires_at;
    }

    /**
     * Check if download limit reached
     */
    public isDownloadLimitReached(): boolean {
        if (this.max_downloads === null) return false;
        return this.download_count >= this.max_downloads;
    }

    /**
     * Check if share link is valid (active, not expired, not limit reached)
     */
    public isValid(): boolean {
        return (
            this.is_active &&
            !this.isExpired() &&
            !this.isDownloadLimitReached()
        );
    }

    /**
     * Generate a cryptographically secure random token
     */
    public static generateToken(): string {
        return crypto.randomBytes(32).toString('hex'); // 64 characters
    }
}

// ========================================
// INITIALIZE: Model Definition
// ========================================
SharedLink.init(
    {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        file_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'files',
                key: 'id'
            },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE',  // ✅ Delete share link when file permanently deleted
            comment: 'File being shared'
        },
        created_by_user_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'users',
                key: 'id'
            },
            onUpdate: 'CASCADE',
            onDelete: 'RESTRICT',  // ✅ Can't delete user
            comment: 'User who created the share link'
        },
        token: {
            type: DataTypes.STRING(64),
            allowNull: false,
            unique: true,
            defaultValue: () => SharedLink.generateToken(),
            comment: 'Unique secure token for the share URL'
        },
        password_hash: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: 'Bcrypt hash of password (null = no password required)'
        },
        expires_at: {
            type: DataTypes.DATE,
            allowNull: true,
            comment: 'Expiration date (null = never expires)'
        },
        max_downloads: {
            type: DataTypes.INTEGER,
            allowNull: true,
            validate: {
                min: 1
            },
            comment: 'Maximum number of downloads (null = unlimited)'
        },
        download_count: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
            validate: {
                min: 0
            },
            comment: 'Number of times file has been downloaded'
        },
        allow_preview: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true,
            comment: 'Allow preview before download'
        },
        is_active: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true,
            comment: 'Can be manually deactivated by user'
        },
        last_accessed_at: {
            type: DataTypes.DATE,
            allowNull: true,
            comment: 'Last time link was accessed'
        }
    },
    {
        sequelize,
        tableName: 'shared_links',
        underscored: true,
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: false, // No updated_at needed
        indexes: [
            {
                unique: true,
                fields: ['token'],
                name: 'unique_token'
            },
            { fields: ['file_id'] },
            { fields: ['created_by_user_id'] },
            { fields: ['expires_at'] },
            { fields: ['is_active'] }
        ]
    }
);

export default SharedLink;