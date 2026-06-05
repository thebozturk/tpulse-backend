// Template: Mongoose Schema
// Kullanım: src/modules/<feature>/schemas/<name>.schema.ts

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type XxxDocument = Xxx & Document;

@Schema({
  timestamps: true,
  versionKey: false,
  toJSON: {
    virtuals: true,
    transform: (_doc, ret) => {
      ret.id = ret._id.toString();
      delete ret._id;
      delete ret.password;           // paranoia
      delete ret.refreshTokenHash;
      return ret;
    },
  },
})
export class Xxx {
  @Prop({ required: true, unique: true, lowercase: true, trim: true, maxlength: 255 })
  email: string;

  @Prop({ required: true, select: false })      // ASLA default select'te dönmesin
  password: string;

  @Prop({ required: true, trim: true, maxlength: 100 })
  name: string;

  @Prop({ enum: ['user', 'admin', 'super_admin'], default: 'user' })
  role: string;

  @Prop({ enum: ['active', 'banned', 'pending'], default: 'pending', index: true })
  status: string;

  @Prop({ default: false })
  emailVerified: boolean;

  @Prop({ type: Types.ObjectId, ref: 'Team', index: true })
  teamId?: Types.ObjectId;

  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop()
  lastLoginAt?: Date;
}

export const XxxSchema = SchemaFactory.createForClass(Xxx);

// Indexes (ESR rule: Equality, Sort, Range)
XxxSchema.index({ status: 1, createdAt: -1 });
XxxSchema.index({ teamId: 1, createdAt: -1 });
// unique index email için otomatik (unique:true)

// Virtuals (opsiyonel)
// XxxSchema.virtual('fullName').get(function() { ... });

// Pre/post hooks (minimal — business logic service'te)
// XxxSchema.pre<XxxDocument>('save', async function() {
//   if (this.isModified('password')) {
//     this.password = await argon2.hash(this.password);
//   }
// });
