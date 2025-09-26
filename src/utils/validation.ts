import Joi from 'joi';

export const emailAccountSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(1).required(),
  imapHost: Joi.string().hostname().required(),
  imapPort: Joi.number().port().default(993),
  isActive: Joi.boolean().default(true)
});

export const emailSearchSchema = Joi.object({
  accountId: Joi.string().uuid().optional(),
  folder: Joi.string().optional(),
  category: Joi.string().valid('interested', 'meeting_booked', 'not_interested', 'spam', 'out_of_office').optional(),
  dateFrom: Joi.alternatives().try(Joi.date(), Joi.string().isoDate()).optional(),
  dateTo: Joi.alternatives().try(Joi.date(), Joi.string().isoDate()).optional(),
  isRead: Joi.boolean().optional(),
  query: Joi.string().max(500).allow('').optional(),
  limit: Joi.number().integer().min(1).max(100).default(20),
  offset: Joi.number().integer().min(0).default(0),
  page: Joi.number().integer().min(1).optional()
});

export const productContextSchema = Joi.object({
  product: Joi.string().min(1).required(),
  outreachAgenda: Joi.string().min(1).required(),
  meetingLink: Joi.string().uri().optional(),
  contactInfo: Joi.string().optional()
});

export const validateRequest = (schema: Joi.ObjectSchema, data: any) => {
  const { error, value } = schema.validate(data, { abortEarly: false });
  
  if (error) {
    const errorMessages = error.details.map(detail => detail.message);
    throw new Error(`Validation error: ${errorMessages.join(', ')}`);
  }
  
  return value;
};
