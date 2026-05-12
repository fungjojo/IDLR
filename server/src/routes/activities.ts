import { Router } from 'express'
import multer from 'multer'
import { requireAuth } from '../middleware/auth'
import { idempotency } from '../middleware/idempotency'
import { uploadActivity } from '../controllers/activitiesController'

const router = Router()
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = file.originalname.split('.').pop()?.toLowerCase()
    if (ext === 'fit' || ext === 'gpx') {
      cb(null, true)
    } else {
      cb(new Error('Only .fit and .gpx files are supported'))
    }
  },
})

router.post('/upload', requireAuth, idempotency, upload.single('file'), uploadActivity)

export default router
