import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';
import type File from './File';

interface FileReferenceAttributes {
    id: string;
    file_hash: string;        // SHA256 hash (unique identifier)
    stored_path: string;      // Physical file location on disk
    reference_count: number;  // How many files point to this
    created_at?: Date;
}

interface FileReferenceCreationAttributes extends Optional<FileReferenceAttributes, 'id' | 'reference_count' | 'created_at'> {}


class FileReference extends Model<FileReferenceAttributes, FileReferenceCreationAttributes> implements FileReferenceAttributes{
    public id!: string;
    public file_hash!: string;
    public stored_path!: string;
    public reference_count!: number;
    public readonly created_at!: Date;
    public readonly files?: File[];
}

FileReference.init(
    {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        file_hash: {
            type: DataTypes.STRING(64),  // SHA256 = 64 hex characters
            allowNull: false,
            unique: true,  // ← CRITICAL: Each hash appears only once!
            comment: 'SHA256 hash of file content - unique identifier'
        },
        stored_path: {
            type: DataTypes.TEXT,
            allowNull: false,
            comment: 'Physical file location on disk (e.g., /ab/cd/abc123...xyz.jpg)'
        },
        reference_count: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 1,
            validate: {
                min: 0  // Can't be negative
            },
            comment: 'Number of File records pointing to this physical file'
        }
    },
    {
        sequelize,
        tableName: 'file_references',
        underscored: true,
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: false,  // ← No updated_at needed (file content never changes)
        indexes: [
            {
                unique: true,
                fields: ['file_hash'],
                name: 'unique_file_hash'
            }
        ]
    }
);
 
export default FileReference;