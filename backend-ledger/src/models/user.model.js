const mongoose = require("mongoose")
const bcrypt = require("bcryptjs")

const userSchema = new mongoose.Schema({
    email: {
        type: String,
        required: [ true, "Email is required for creating a user" ],
        trim: true,
        lowercase: true,
        match: [ /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, "Invalid Email address" ],
        unique: [ true, "Email already exists." ]
    },
    name: {
        type: String,
        required: [ true, "Name is required for creating an account" ],
        trim: true,
        maxlength: [ 100, "Name cannot exceed 100 characters" ]
    },
    password: {
        type: String,
        required: [ true, "Password is required for creating an account" ],
        minlength: [ 6, "Password should contain at least 6 characters" ],
        maxlength: [ 128, "Password cannot exceed 128 characters" ],
        select: false
    },
    emailVerified: {
        type: Boolean,
        default: false,
        index: true
    },
    emailVerificationTokenHash: {
        type: String,
        select: false
    },
    emailVerificationExpiresAt: {
        type: Date,
        select: false
    },
    passwordResetTokenHash: {
        type: String,
        select: false
    },
    passwordResetExpiresAt: {
        type: Date,
        select: false
    },
    authVersion: {
        type: Number,
        default: 0,
        select: false
    }
}, {
    timestamps: true
})

userSchema.pre("save", async function () {
    if (!this.isModified("password")) {
        return
    }

    const hash = await bcrypt.hash(this.password, 10)
    this.password = hash
})

userSchema.methods.comparePassword = async function (password) {
    return bcrypt.compare(password, this.password)
}

userSchema.methods.toSafeObject = function () {
    return {
        _id: this._id,
        email: this.email,
        name: this.name,
        emailVerified: this.emailVerified
    }
}

const userModel = mongoose.model("user", userSchema)

module.exports = userModel
