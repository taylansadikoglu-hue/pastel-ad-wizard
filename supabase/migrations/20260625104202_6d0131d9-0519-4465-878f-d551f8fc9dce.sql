REVOKE SELECT (slack_webhook_url) ON public.agency_profiles FROM authenticated, anon;

DROP POLICY IF EXISTS authenticated_can_receive_realtime_messages ON realtime.messages;
CREATE POLICY authenticated_can_receive_realtime_messages
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() = ('user:' || auth.uid()::text)
);