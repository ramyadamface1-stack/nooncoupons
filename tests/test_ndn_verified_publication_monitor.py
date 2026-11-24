"""No-network tests: trust R2 ledger + genuinely recent live article, not Cron toggle."""
import datetime as dt
import importlib.util
import pathlib
import unittest

path=pathlib.Path(__file__).resolve().parents[1]/"scripts"/"ndn_verified_publication_monitor.py"
spec=importlib.util.spec_from_file_location("ndn_verified_publication_monitor",path)
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

NOW=dt.datetime(2026,11,24,6,30,tzinfo=dt.timezone.utc)
def row(slug,country,at,provider="gemini"):
    return {"slug":slug,"country":country,"publishedAt":at,"provider":provider}
def health(at="2026-11-24T06:23:46Z",enabled=True,http=200,reason="LIVE_VERIFIED"):
    return {"ok":True,"schedulerEnabled":enabled,"directStage":"production",
            "controlStatus":"POLICY_VERIFIED","siteServiceBindingConfigured":True,
            "readyCount":1,
            "lastLiveVerification":{"at":at,"slug":"saudi-example-good-nov170-2026-n12",
                                    "reason":reason,"http":http},
            "marketGeneration":{"SA":{"phase":"READY_CREATED","provider":"gemini"},
                                "AE":{"phase":"PROVIDER_QUOTA","provider":"groq","http":429}}}

class NativeMonitorTests(unittest.TestCase):
    def test_recent_verified_status_and_per_provider_counts(self):
        ledger={"version":1,"articles":[
            row("saudi-example-good-nov170-2026-n12","SA","2026-11-24T06:23:45Z"),
            row("uae-second-example-nov188-2026-n12","AE","2026-11-24T06:16:00Z","groq"),
            row("saudi-prior-example-nov170-2026-n12","SA","2026-11-23T12:00:00Z","groq")
        ]}
        result=module.summarize(health(),ledger,NOW)
        self.assertTrue(result["publishingRecentlyVerified"])
        self.assertTrue(result["directWorkerConfigured"])
        self.assertEqual(result["lastHour"]["total"],2)
        self.assertEqual(result["lastHour"]["gemini"],1)
        self.assertEqual(result["lastHour"]["groq"],1)
        self.assertEqual(result["last24Hours"]["total"],3)
        self.assertTrue(result["belowTarget60PerHour"])
        self.assertEqual(result["markets"]["AE"]["http"],429)
        self.assertEqual(result["readyCount"],1)
    def test_cron_enabled_does_not_misreport_22_hour_stall(self):
        h=health("2026-11-23T06:00:00Z")
        r=module.summarize(h,{"version":1,"articles":[]},NOW)
        self.assertTrue(r["directWorkerConfigured"])
        self.assertFalse(r["publishingRecentlyVerified"])
        self.assertGreater(r["lastLiveVerified"]["minutesAgo"],90)
    def test_exact_stall_threshold_and_disabled_controls(self):
        h=health("2026-11-24T05:00:00Z")
        self.assertFalse(module.summarize(h,{"version":1,"articles":[]},NOW)["publishingRecentlyVerified"])
        h=health(enabled=False)
        self.assertFalse(module.summarize(h,{"version":1,"articles":[]},NOW)["publishingRecentlyVerified"])
        h=health(reason="STORED_AWAITING_VERIFICATION")
        self.assertFalse(module.summarize(h,{"version":1,"articles":[]},NOW)["publishingRecentlyVerified"])
        h=health(http=503)
        self.assertFalse(module.summarize(h,{"version":1,"articles":[]},NOW)["publishingRecentlyVerified"])
    def test_wrong_market_and_duplicate_ledger_fail_closed(self):
        with self.assertRaises(ValueError):
            module.summarize({},{"version":1,"articles":[row("a","EG","2026-11-24T06:00:00Z")]},NOW)
        a=row("same","SA","2026-11-24T06:00:00Z")
        with self.assertRaises(ValueError):
            module.summarize({},{"version":1,"articles":[a,a]},NOW)
    def test_missing_timestamp_does_not_invent_publication(self):
        a=row("saudi-unknown","SA","not-a-date")
        result=module.summarize(health(),{"version":1,"articles":[a]},NOW)
        self.assertNotIn("total",result["lastHour"])
        self.assertIsNone(result["lastLedgerPublication"])
        self.assertFalse(module.summarize({"ok":True,"schedulerEnabled":True},
                                          {"version":1,"articles":[a]},NOW)["publishingRecentlyVerified"])

if __name__=="__main__":
    unittest.main()
