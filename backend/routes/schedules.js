const router  = require('express').Router();
const ctrl    = require('../controllers/scheduleController');
const auth    = require('../middleware/auth');
const reqRole = require('../middleware/roleCheck');

router.get('/',     auth, ctrl.getAll);               // any authenticated user can list
router.get('/:id',  auth, reqRole('admin'), ctrl.getOne);
router.post('/',    auth, reqRole('admin'), ctrl.create);
router.put('/:id',  auth, reqRole('admin'), ctrl.update);
router.delete('/:id', auth, reqRole('admin'), ctrl.remove);

module.exports = router;
