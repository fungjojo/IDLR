import { Router } from 'express'
import multer from 'multer'
import { requireAuth } from '../middleware/auth'
import { idempotency } from '../middleware/idempotency'
import {
  uploadActivity,
  getActivities,
  getActivity,
  deleteActivity,
} from '../controllers/activitiesController'

const router = Router()
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = file.originalname.split('.').pop()?.toLowerCase()
    cb(null, ext === 'fit' || ext === 'gpx')
  },
})

router.get('/', requireAuth, getActivities)
router.get('/:id', requireAuth, getActivity)
router.delete('/:id', requireAuth, deleteActivity)
router.post('/upload', requireAuth, idempotency, upload.single('file'), uploadActivity)

export default router
