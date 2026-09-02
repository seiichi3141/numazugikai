"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form } from "@/components/ui/form";

import type { CouncilSession } from "@/features/council-sessions/shared/types";
import { createBill } from "../../server/actions/create-bill";
import { type BillCreateInput, billCreateSchema } from "../../shared/types";
import { useBillForm } from "../hooks/use-bill-form";
import { BillFormFields } from "./bill-form-fields";

interface BillCreateFormProps {
  councilSessions: CouncilSession[];
}

export function BillCreateForm({ councilSessions }: BillCreateFormProps) {
  const { isSubmitting, error, handleSubmit, handleCancel } = useBillForm();

  // Default to the latest session (first in the list, sorted by start_date desc)
  const defaultCouncilSessionId =
    councilSessions.length > 0 ? councilSessions[0].id : null;

  const form = useForm<BillCreateInput>({
    resolver: zodResolver(billCreateSchema),
    defaultValues: {
      name: "",
      status: "preparing",
      submitter: "mayor",
      status_note: null,
      submitted_date: new Date().toLocaleDateString("sv-SE", {
        timeZone: "Asia/Tokyo",
      }),
      thumbnail_url: null,
      share_thumbnail_url: null,
      source_url: null,
      slug: null,
      is_featured: false,
      is_review_completed: false,
      council_session_id: defaultCouncilSessionId,
      knowledge_source: "",
      use_knowledge_source_in_chat: false,
    },
  });

  const onSubmit = (data: BillCreateInput) => {
    handleSubmit(() => createBill(data), "作成中にエラーが発生しました");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>議案新規作成</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <BillFormFields
              control={form.control}
              councilSessions={councilSessions}
            />

            {error && (
              <div className="rounded-md bg-red-50 p-4 text-sm text-red-800">
                {error}
              </div>
            )}

            <div className="flex items-center gap-4">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "作成中..." : "作成"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                disabled={isSubmitting}
              >
                キャンセル
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
