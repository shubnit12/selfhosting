import { Optional, Model, DataTypes } from 'sequelize';
import sequelize from '../config/database';
import User from './User';
import File from './File'
import ActivityLog from './ActivityLog';


interface FolderAttributes{
    id:string;
    user_id:string;
    parent_folder_id:string | null;
    name:string;
    path:string;
    is_deleted:boolean;
    deleted_at:Date | null;
    created_at?: Date;
    updated_at?: Date;
    is_public: boolean;
    public_slug: string | null;
}

interface FolderCreationAttributes extends Optional<FolderAttributes, 'id' | 'parent_folder_id' | 'is_deleted' | 'deleted_at' | 'is_public' | 'public_slug' | 'created_at' | 'updated_at'> {}

class Folder extends Model <FolderAttributes, FolderCreationAttributes> implements FolderAttributes{
    public id!: string;
    public user_id!: string;
    public parent_folder_id!: string | null;
    public name!: string;
    public path!: string;
    public is_deleted!: boolean;
    public deleted_at!: Date | null;
    public readonly created_at!: Date;
    public readonly updated_at!: Date;
    public owner?: User;
    public subfolders?: Folder[];
    public parentFolder?: Folder;
    public files?: File[];
    public activityLogs?: ActivityLog[];
    public is_public!: boolean;
    public public_slug!: string | null;
}

Folder.init(
    {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        user_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'users',
                key: 'id'
            },
            onUpdate: 'CASCADE',
            onDelete: 'RESTRICT',  // ✅ Can't delete user
            comment: 'Folder owner'
        },
        parent_folder_id: {
            type: DataTypes.UUID,
            allowNull: true,
            references: {
                model: 'folders',
                key: 'id'
            },
            onUpdate: 'CASCADE',
            onDelete: 'SET NULL',  // ✅ Safety: if parent hard-deleted, becomes root
            comment: 'Parent folder (null = root)'
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false
        },
        path: {
            type: DataTypes.TEXT,
            allowNull: false
        },
        is_deleted: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        },
        deleted_at: {
            type: DataTypes.DATE,
            allowNull: true
        },
        is_public: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    comment: 'Whether folder is publicly accessible'
},
public_slug: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true,
    comment: 'Custom URL slug for public access (e.g., "memes", "icons")'
}
    },
    {
        sequelize,
        tableName: 'folders',
        underscored: true,
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
            { fields: ['user_id'] },
            { fields: ['parent_folder_id'] },
            { fields: ['is_public'] },
            { fields: ['public_slug'], unique: true }
        ]
    }
);

export default Folder;