/* eslint-disable quotes */
import { readFileSync } from "fs"
import { prisma } from "../src/infra/prismaClient"
import path from "path"

export async function databaseSetup() {
    const user: Array<object> = await prisma.$queryRaw`SELECT * FROM User WHERE role = 'SYSTEM_ADMIN';`

    if (!user || user.length === 0) {
        const createUserSQL = readFileSync(path.join(__dirname, 'create-user.sql'), "utf-8")
        
        try {
            await prisma.$executeRawUnsafe(createUserSQL)
            console.log("Root user created")
        } catch (error: any) {
            console.log("Create root user script failed", error.message)
        }
    }
    
    const dayWeek: Array<object> = await prisma.$queryRaw`SELECT * FROM DayOfWeek;`

    if (!dayWeek || dayWeek.length === 0) {
        const createDaysOfWeekSQL = readFileSync(path.join(__dirname, 'create-days-of-week.sql'), "utf-8")

        try {
            await prisma.$executeRawUnsafe(createDaysOfWeekSQL)
            console.log("Days of week created")
        } catch (error: any) {
            console.log("Create days of week script failed", error.message)
        }
    }
}

databaseSetup()