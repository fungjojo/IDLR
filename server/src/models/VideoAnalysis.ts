import { Schema, model, type Document, type Types } from 'mongoose'

export interface IVideoAnalysis extends Document {
  userId: Types.ObjectId
  activityId?: Types.ObjectId
  videoStoragePath: string
  poseFeedback: string[]
  createdAt: Date
  updatedAt: Date
}

const videoAnalysisSchema = new Schema<IVideoAnalysis>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    activityId: { type: Schema.Types.ObjectId, ref: 'Activity' },
    videoStoragePath: { type: String, required: true },
    poseFeedback: { type: [String], default: [] },
  },
  { timestamps: true },
)

export const VideoAnalysis = model<IVideoAnalysis>('VideoAnalysis', videoAnalysisSchema)
