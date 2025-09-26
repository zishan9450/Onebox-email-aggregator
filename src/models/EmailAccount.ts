import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';
import { EmailAccount as EmailAccountType } from '../types';

interface EmailAccountCreationAttributes extends Optional<EmailAccountType, 'id' | 'createdAt' | 'updatedAt'> {}

class EmailAccount extends Model<EmailAccountType, EmailAccountCreationAttributes> implements EmailAccountType {
  public id!: string;
  public email!: string;
  public password!: string;
  public imapHost!: string;
  public imapPort!: number;
  public isActive!: boolean;
  public lastSync?: Date;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

EmailAccount.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
      },
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    imapHost: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    imapPort: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 993,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    lastSync: {
      type: DataTypes.DATE,
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
    modelName: 'EmailAccount',
    tableName: 'email_accounts',
    timestamps: true,
  }
);

export default EmailAccount;
