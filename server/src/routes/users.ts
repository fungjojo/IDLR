import { Router } from 'express'
import { getUsers, deleteUser } from '../controllers/userController'
import { requireAuth } from '../middleware/auth'
import { adminOnly } from '../middleware/adminOnly'

const router = Router()

router.get('/', requireAuth, adminOnly, getUsers)
router.delete('/:id', requireAuth, adminOnly, deleteUser)

export default router
