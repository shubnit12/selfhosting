import {DataTypes, Model, Optional} from 'sequelize';
import sequelize from '../config/database';
import User from './User';
import Folder from './Folder';
import FileReference from './FileReference';
import SharedLink from './SharedLink';
import ActivityLog from './ActivityLog';

interface FileAttributes{
    id: string;
    user_id: string;
    folder_id: string | null;
    original_name: string;
    stored_name: string;
    file_path: string;
    file_hash: string;
    mime_type: string;
    size: number;
    thumbnail_path: string | null;
    preview_path: string | null;
    version: number;
    parent_file_id: string | null;
    upload_status: 'uploading' | 'completed' | 'failed';
    is_available: boolean;   
    is_deleted:boolean;
    deleted_at: Date | null;
    created_at?: Date;
    updated_at?: Date;
}
interface FileCreationsAttributes extends Optional<FileAttributes,  'id' | 'folder_id' | 'thumbnail_path' | 'preview_path' | 'version' | 
    'parent_file_id' | 'upload_status' | 'is_available' | 'is_deleted' | 'deleted_at' | 'created_at' | 'updated_at'> {}

class File extends Model<FileAttributes, FileCreationsAttributes> implements FileAttributes{
    public id!: string;
    public user_id!: string;
    public folder_id!: string | null;
    public original_name!: string;
    public stored_name!: string;
    public file_path!: string;
    public file_hash!: string;
    public mime_type!: string;
    public size!: number;
    public thumbnail_path!: string | null;
    public preview_path!: string | null;
    public version!: number;
    public parent_file_id!: string | null;
    public upload_status!: 'uploading' | 'completed' | 'failed';
    public is_available!: boolean; 
    public is_deleted!: boolean;
    public deleted_at!: Date | null;
    public readonly created_at!: Date;
    public readonly updated_at!: Date;
    public owner?: User;
    public folder?: Folder;
    public versions?: File[];
    public parentVersion?: File;
    public fileReference?: FileReference;
    public sharedLinks?: SharedLink[];
    public activityLogs?: ActivityLog[];
}
File.init(
    {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey:true
        },
        user_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'users',
                key: 'id'
            },
            onUpdate: 'CASCADE',
            onDelete: 'RESTRICT',  // ✅ Can't delete user (they're deactivated instead)
            comment: 'File owner'
        },
        folder_id: {
            type: DataTypes.UUID,
            allowNull: true,
            references: {
                model: 'folders',
                key: 'id'
            },
            onUpdate: 'CASCADE',
            onDelete: 'SET NULL',  // ✅ Safety: if folder hard-deleted, file moves to root
            comment: 'Folder location (null = root)'
        },
        original_name: {
            type: DataTypes.STRING,
            allowNull: false
        },
        stored_name: {
            type: DataTypes.STRING,
            allowNull: false
        },
        file_path: {
            type: DataTypes.TEXT,
            allowNull: false
        },
        file_hash: {
            type: DataTypes.STRING,
            allowNull: false
        },
        mime_type: {
            type: DataTypes.STRING,
            allowNull: false
        },
        size: {
            type: DataTypes.BIGINT,
            allowNull: false
        },
        thumbnail_path: {
            type: DataTypes.TEXT,
            allowNull: true,
            comment: 'Path to generated thumbnail (if applicable)'
        },
        preview_path: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        version: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 1
        },
        parent_file_id: {
            type: DataTypes.UUID,
            allowNull: true,
            references: {
                model: 'files',
                key: 'id'
            },
            onUpdate: 'CASCADE',
            onDelete: 'SET NULL',  // ✅ Keep versions if parent deleted
            comment: 'Parent file for versioning'
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
        upload_status: {                                         
            type: DataTypes.ENUM('uploading', 'completed', 'failed'),
            allowNull: false,
            defaultValue: 'completed',
            comment: 'Upload status: uploading (in progress), completed (ready), failed (corrupted)'
        },
        is_available: {                                           
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true,
            comment: 'File is available for download (false during upload)'
        }

    },{
         sequelize,
        tableName: 'files',
        underscored: true,
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
            { fields: ['user_id'] },
            { fields: ['folder_id'] },
            { fields: ['file_hash'] },
            { fields: ['parent_file_id'] },
            { fields: ['is_deleted'] },
            { fields: ['created_at'] },
            { fields: ['upload_status'] }
        ]
    }
)
export default File;
