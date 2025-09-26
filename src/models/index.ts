import EmailAccount from './EmailAccount';
import Email from './Email';

// Define associations
EmailAccount.hasMany(Email, { foreignKey: 'accountId', as: 'emails' });
Email.belongsTo(EmailAccount, { foreignKey: 'accountId', as: 'account' });

export { EmailAccount, Email };
