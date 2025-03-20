import { Router } from "express";
import {loginUser, logoutUser, registerUser, refreshAccessToken, addCandidate, editCandidate, listOfCandidate, getCurrentUser, deleteCandidate, filterCandidate} from '../controllers/user.controller.js'
import { upload } from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router()

router.route('/register').post( upload.fields([
    {
        name: "avatar",
        maxCount: 1
    },
    {
        name: "coverImage",
        maxCount: 1
    }
]) ,
registerUser)

router.route('/login').post(loginUser)

router.route('/logout').post(verifyJWT, logoutUser)

router.route('/refresh-token').post(refreshAccessToken)

router.route('/add').post(verifyJWT, addCandidate)

router.route('/current-user').post(verifyJWT, getCurrentUser)

router.route("/edit/:id").post(verifyJWT, editCandidate);

router.route('/list').get(verifyJWT, listOfCandidate)

router.route('/delete/:id').delete(verifyJWT, deleteCandidate)

router.route('/filter').post(verifyJWT, filterCandidate)

export default router;