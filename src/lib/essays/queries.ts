import "server-only";
import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb, schema } from "@/db";
import { getLearner } from "@/lib/session";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getEssay(id: string) {
    if (!UUID_RE.test(id)) {
        return null;
    }
    const learner = await getLearner();
    if (!learner) {
        redirect("/sign-in?next=/write/" + id);
    }
    const [essay] = await getDb()
        .select()
        .from(schema.essays)
        .where(and(eq(schema.essays.id, id), eq(schema.essays.learnerId, learner.id)));
    if (!essay) {
        return null;
    }
    return { essay, learnerId: learner.id };
}
