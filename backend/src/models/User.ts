import {DataTypes, Model, Optional} from 'sequelize';
import sequelize from '../config/database';
import Folder from './Folder';
import File from './File'
import SharedLink from './SharedLink';
import ActivityLog from './ActivityLog';

interface UserAttributes{
    id: string;
    username: string;
    email: string;
    password_hash: string;
    role: 'admin' | 'user';
    storage_quota: number | null;
    storage_used: number;
    two_fa_secret: string | null;
    two_fa_enabled: boolean;
    is_active: boolean;
    created_at?: Date;
    updated_at?: Date;
    deleted_at: Date | null;

}

interface UserCreationAttributes extends Optional<UserAttributes, 'id' | 'storage_used' | 'two_fa_secret' | 'two_fa_enabled' | 'is_active' | 'deleted_at' | 'created_at' | 'updated_at'> {}


class User extends Model <UserAttributes, UserCreationAttributes> implements UserAttributes{
    public id!: string;
    public username!: string;
    public email!: string;
    public password_hash!: string;
    public role!: 'admin' | 'user';
    public storage_quota!: number | null;
    public storage_used!: number;
    public two_fa_secret!: string | null;
    public two_fa_enabled!: boolean;
    public is_active!: boolean;
    public readonly created_at!: Date;
    public readonly updated_at!: Date;
    public folders?: Folder[];
    public deleted_at!: Date | null;
    public files?: File[]
    public sharedLinks?: SharedLink[];
    public activityLogs?: ActivityLog[];
}

User.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
      },
      username: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
      },
      email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: {
          isEmail: true
        }
      },
      password_hash: {
        type: DataTypes.STRING,
        allowNull: false
      },
      role: {
        type: DataTypes.ENUM('admin', 'user'),
        allowNull: false,
        defaultValue: 'user'
      },
      storage_quota: {
        type: DataTypes.BIGINT,
        allowNull: true,
        comment: 'null = unlimited (for admin)'
      },
      storage_used: {
        type: DataTypes.BIGINT,
        allowNull: false,
        defaultValue: 0
      },
      two_fa_secret: {
        type: DataTypes.STRING,
        allowNull: true
      },
      two_fa_enabled: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
       is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'User account status (false = deactivated by admin)'
        },
        deleted_at: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Timestamp when user was soft deleted'
}
    },
    {
      sequelize,
      tableName: 'users',
      underscored: true,
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      indexes: [
            { fields: ['is_active'] }  // ← ADD INDEX for fast queries
        ]
    }
  );

  export default User;