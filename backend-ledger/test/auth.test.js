const assert = require("node:assert/strict")
const test = require("node:test")
const mongoose = require("mongoose")
const request = require("supertest")
const { MongoMemoryReplSet } = require("mongodb-memory-server")

process.env.NODE_ENV = "test"
process.env.JWT_SECRET = "test-secret-that-is-long-enough"
process.env.FRONTEND_URL = "http://localhost:5173"

const app = require("../src/app")
const connectToDB = require("../src/config/db")

let mongo

test.before(async () => {
    mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
    await connectToDB(mongo.getUri())
})

test.after(async () => {
    await mongoose.disconnect()
    if (mongo) await mongo.stop()
})

function tokenFromPreview(previewUrl, key) {
    return new URL(previewUrl).searchParams.get(key)
}

test("email verification, password recovery and account deletion", async () => {
    const email = "student@example.com"
    const oldPassword = "student123"
    const newPassword = "newpassword123"

    const registration = await request(app).post("/api/auth/register").send({
        name: "Student User",
        email,
        password: oldPassword
    })
    assert.equal(registration.status, 201)
    assert.ok(registration.body.previewUrl)

    const blockedLogin = await request(app).post("/api/auth/login").send({ email, password: oldPassword })
    assert.equal(blockedLogin.status, 403)

    const verificationToken = tokenFromPreview(registration.body.previewUrl, "verify")
    const verification = await request(app).post("/api/auth/verify-email").send({ token: verificationToken })
    assert.equal(verification.status, 200)

    const oldSession = request.agent(app)
    const login = await oldSession.post("/api/auth/login").send({ email, password: oldPassword })
    assert.equal(login.status, 200)
    assert.equal(login.body.user.emailVerified, true)

    const wallet = (await oldSession.post("/api/accounts").send({ name: "Wallet" })).body.account
    const savings = (await oldSession.post("/api/accounts").send({ name: "Savings" })).body.account

    assert.equal((await oldSession.post("/api/expenses").send({
        accountId: wallet._id,
        amount: 1000,
        type: "income",
        category: "Salary & Income"
    })).status, 201)

    assert.equal((await oldSession.post("/api/transactions").send({
        fromAccount: wallet._id,
        toAccount: savings._id,
        amount: 250,
        idempotencyKey: "test-transfer-1"
    })).status, 201)

    assert.equal((await oldSession.post("/api/expenses").send({
        accountId: wallet._id,
        amount: 100,
        type: "expense",
        category: "Food & Dining"
    })).status, 201)

    assert.equal((await oldSession.get(`/api/accounts/balance/${wallet._id}`)).body.balance, 650)
    assert.equal((await oldSession.get(`/api/accounts/balance/${savings._id}`)).body.balance, 250)
    assert.equal((await oldSession.post("/api/budgets").send({ category: "Food & Dining", limit: 500 })).status, 200)

    const forgot = await request(app).post("/api/auth/forgot-password").send({ email })
    assert.equal(forgot.status, 200)
    const resetToken = tokenFromPreview(forgot.body.previewUrl, "reset")

    const reset = await request(app).post("/api/auth/reset-password").send({ token: resetToken, password: newPassword })
    assert.equal(reset.status, 200)
    assert.equal((await oldSession.get("/api/auth/session")).status, 401)
    assert.equal((await request(app).post("/api/auth/login").send({ email, password: oldPassword })).status, 401)

    const newSession = request.agent(app)
    assert.equal((await newSession.post("/api/auth/login").send({ email, password: newPassword })).status, 200)
    assert.equal((await newSession.delete("/api/auth/account").send({ password: "wrong-password", confirmation: "DELETE" })).status, 401)
    assert.equal((await newSession.delete("/api/auth/account").send({ password: newPassword, confirmation: "DELETE" })).status, 200)
    assert.equal((await newSession.get("/api/auth/session")).status, 401)
})
