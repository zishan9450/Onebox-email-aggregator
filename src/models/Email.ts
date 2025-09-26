import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';
import { Email as EmailType, EmailCategory } from '../types';

interface EmailCreationAttributes extends Optional<EmailType, 'id' | 'createdAt' | 'updatedAt'> {}

class Email extends Model<EmailType, EmailCreationAttributes> implements EmailType {
  public id!: string;
  public accountId!: string;
  public messageId!: string;
  public subject!: string;
  public from!: string;
  public to!: string[];
  public cc?: string[];
  public bcc?: string[];
  public date!: Date;
  public body!: string;
  public htmlBody?: string;
  public attachments?: any[];
  public folder!: string;
  public isRead!: boolean;
  public isFlagged!: boolean;
  public category?: EmailCategory;
  public aiCategory?: string;
  public aiConfidence?: number;
  public suggestedReply?: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Email.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    accountId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'email_accounts',
        key: 'id',
      },
    },
    messageId: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    subject: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    from: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    to: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: false,
    },
    cc: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
    },
    bcc: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
    },
    date: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    body: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    htmlBody: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    attachments: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    folder: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'INBOX',
    },
    isRead: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    isFlagged: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    category: {
      type: DataTypes.ENUM('interested', 'meeting_booked', 'not_interested', 'spam', 'out_of_office'),
      allowNull: true,
    },
    aiCategory: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    aiConfidence: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    suggestedReply: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  },
  {
    sequelize,
    modelName: 'Email',
    tableName: 'emails',
    timestamps: true,
    indexes: [
      {
        fields: ['account_id'],
      },
      {
        fields: ['message_id'],
        unique: true,
      },
      {
        fields: ['date'],
      },
      {
        fields: ['category'],
      },
      {
        fields: ['folder'],
      },
    ],
  }
);

export default Email;
