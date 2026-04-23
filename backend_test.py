#!/usr/bin/env python3
"""
Comprehensive SSDBench Backend API Testing
Tests all endpoints as specified in the review request.
"""

import asyncio
import json
import time
import requests
import websocket
from typing import Dict, Any, List, Optional

# Base URLs from environment
BASE_URL = "https://linux-io-metrics.preview.emergentagent.com"
WS_BASE_URL = "wss://linux-io-metrics.preview.emergentagent.com"

class SSDBenchTester:
    def __init__(self):
        self.session = requests.Session()
        self.session.timeout = 30
        self.test_results = []
        self.job_ids = []
        
    def log_test(self, test_name: str, success: bool, details: str = ""):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}")
        if details:
            print(f"    {details}")
        self.test_results.append({
            "test": test_name,
            "success": success,
            "details": details
        })
        
    def test_health_endpoint(self) -> bool:
        """Test 1: GET /api/ - should return {message, fio:true}"""
        try:
            response = self.session.get(f"{BASE_URL}/api/")
            
            if response.status_code != 200:
                self.log_test("GET /api/ health", False, f"Status code: {response.status_code}")
                return False
                
            data = response.json()
            
            # Check required fields
            if "message" not in data:
                self.log_test("GET /api/ health", False, "Missing 'message' field")
                return False
                
            if "fio" not in data:
                self.log_test("GET /api/ health", False, "Missing 'fio' field")
                return False
                
            if data["fio"] is not True:
                self.log_test("GET /api/ health", False, f"fio should be true, got: {data['fio']}")
                return False
                
            self.log_test("GET /api/ health", True, f"Message: {data['message']}, fio: {data['fio']}")
            return True
            
        except Exception as e:
            self.log_test("GET /api/ health", False, f"Exception: {str(e)}")
            return False
            
    def test_disks_endpoint(self) -> bool:
        """Test 2: GET /api/disks - should return {disks: [...]} with FILE target"""
        try:
            response = self.session.get(f"{BASE_URL}/api/disks")
            
            if response.status_code != 200:
                self.log_test("GET /api/disks", False, f"Status code: {response.status_code}")
                return False
                
            data = response.json()
            
            if "disks" not in data:
                self.log_test("GET /api/disks", False, "Missing 'disks' field")
                return False
                
            disks = data["disks"]
            if not isinstance(disks, list) or len(disks) == 0:
                self.log_test("GET /api/disks", False, "disks should be non-empty list")
                return False
                
            # Find FILE type disk with path=/data/ssdbench.test
            file_disk = None
            for disk in disks:
                if disk.get("type") == "FILE" and disk.get("path") == "/data/ssdbench.test":
                    file_disk = disk
                    break
                    
            if not file_disk:
                self.log_test("GET /api/disks", False, "No FILE type disk with path=/data/ssdbench.test found")
                return False
                
            # Check required fields
            required_fields = ["id", "path", "label", "type", "totalBytes", "freeBytes", 
                             "usedPercent", "model", "rotation", "interface", "readable", "writable"]
            
            missing_fields = []
            for field in required_fields:
                if field not in file_disk:
                    missing_fields.append(field)
                    
            if missing_fields:
                self.log_test("GET /api/disks", False, f"Missing fields in FILE disk: {missing_fields}")
                return False
                
            self.log_test("GET /api/disks", True, f"Found {len(disks)} disks including FILE target")
            return True
            
        except Exception as e:
            self.log_test("GET /api/disks", False, f"Exception: {str(e)}")
            return False
            
    def test_meta_endpoint(self) -> bool:
        """Test 3: GET /api/meta - should return presets and stages"""
        try:
            response = self.session.get(f"{BASE_URL}/api/meta")
            
            if response.status_code != 200:
                self.log_test("GET /api/meta", False, f"Status code: {response.status_code}")
                return False
                
            data = response.json()
            
            if "presets" not in data:
                self.log_test("GET /api/meta", False, "Missing 'presets' field")
                return False
                
            if "stages" not in data:
                self.log_test("GET /api/meta", False, "Missing 'stages' field")
                return False
                
            presets = data["presets"]
            stages = data["stages"]
            
            # Check presets contain fast/medium/full
            expected_presets = ["fast", "medium", "full"]
            for preset in expected_presets:
                if preset not in presets:
                    self.log_test("GET /api/meta", False, f"Missing preset: {preset}")
                    return False
                    
            # Check stages has 5 items
            if len(stages) != 5:
                self.log_test("GET /api/meta", False, f"Expected 5 stages, got {len(stages)}")
                return False
                
            self.log_test("GET /api/meta", True, f"Presets: {list(presets.keys())}, Stages: {len(stages)}")
            return True
            
        except Exception as e:
            self.log_test("GET /api/meta", False, f"Exception: {str(e)}")
            return False
            
    def test_benchmark_start(self) -> Optional[str]:
        """Test 4: POST /api/benchmark/start - should return {job_id}"""
        try:
            payload = {
                "target": "/data/ssdbench.test",
                "preset": "fast",
                "stages": ["seq_read", "seq_write"]
            }
            
            response = self.session.post(f"{BASE_URL}/api/benchmark/start", json=payload)
            
            if response.status_code != 200:
                self.log_test("POST /api/benchmark/start", False, f"Status code: {response.status_code}")
                return None
                
            data = response.json()
            
            if "job_id" not in data:
                self.log_test("POST /api/benchmark/start", False, "Missing 'job_id' field")
                return None
                
            job_id = data["job_id"]
            if not job_id or not isinstance(job_id, str):
                self.log_test("POST /api/benchmark/start", False, f"Invalid job_id: {job_id}")
                return None
                
            self.job_ids.append(job_id)
            self.log_test("POST /api/benchmark/start", True, f"Job ID: {job_id}")
            return job_id
            
        except Exception as e:
            self.log_test("POST /api/benchmark/start", False, f"Exception: {str(e)}")
            return None
            
    def test_websocket_events(self, job_id: str) -> bool:
        """Test 5: WS /api/benchmark/ws/{job_id} - collect events until done"""
        try:
            ws_url = f"{WS_BASE_URL}/api/benchmark/ws/{job_id}"
            
            events_received = []
            expected_events = {"snapshot", "log", "stage_start", "stage_result", "done"}
            stages_completed = set()
            
            def on_message(ws, message):
                try:
                    event = json.loads(message)
                    event_type = event.get("type")
                    events_received.append(event_type)
                    
                    if event_type == "stage_result":
                        stage_key = event.get("stageKey")
                        if stage_key:
                            stages_completed.add(stage_key)
                            
                    if event_type == "done":
                        ws.close()
                        
                except Exception as e:
                    print(f"Error parsing WebSocket message: {e}")
                    
            def on_error(ws, error):
                print(f"WebSocket error: {error}")
                
            def on_close(ws, close_status_code, close_msg):
                pass
                
            def on_open(ws):
                print(f"WebSocket connected to {ws_url}")
                
            ws = websocket.WebSocketApp(ws_url,
                                      on_open=on_open,
                                      on_message=on_message,
                                      on_error=on_error,
                                      on_close=on_close)
            
            # Run WebSocket with timeout
            start_time = time.time()
            ws.run_forever()
            
            # Check if we got expected events
            received_event_types = set(events_received)
            missing_events = expected_events - received_event_types
            
            if missing_events:
                self.log_test("WebSocket events", False, f"Missing events: {missing_events}")
                return False
                
            # Check if both stages completed
            expected_stages = {"seq_read", "seq_write"}
            missing_stages = expected_stages - stages_completed
            
            if missing_stages:
                self.log_test("WebSocket events", False, f"Missing stage results: {missing_stages}")
                return False
                
            elapsed = time.time() - start_time
            if elapsed > 60:
                self.log_test("WebSocket events", False, f"Timeout: {elapsed:.1f}s > 60s")
                return False
                
            self.log_test("WebSocket events", True, f"All events received in {elapsed:.1f}s")
            return True
            
        except Exception as e:
            self.log_test("WebSocket events", False, f"Exception: {str(e)}")
            return False
            
    def test_job_status_after_done(self, job_id: str) -> bool:
        """Test 6: GET /api/benchmark/{job_id} after done - check status and results"""
        try:
            # Wait a bit for job to complete
            time.sleep(2)
            
            response = self.session.get(f"{BASE_URL}/api/benchmark/{job_id}")
            
            if response.status_code != 200:
                self.log_test("GET /api/benchmark/{job_id} after done", False, f"Status code: {response.status_code}")
                return False
                
            data = response.json()
            
            if data.get("status") != "done":
                self.log_test("GET /api/benchmark/{job_id} after done", False, f"Status should be 'done', got: {data.get('status')}")
                return False
                
            results = data.get("results", {})
            if not results:
                self.log_test("GET /api/benchmark/{job_id} after done", False, "Missing results")
                return False
                
            # Check both stages have results
            expected_stages = ["seq_read", "seq_write"]
            for stage in expected_stages:
                if stage not in results:
                    self.log_test("GET /api/benchmark/{job_id} after done", False, f"Missing result for stage: {stage}")
                    return False
                    
                stage_result = results[stage]
                required_fields = ["value", "unit", "latency_us", "p99_ms", "rating"]
                
                for field in required_fields:
                    if field not in stage_result:
                        self.log_test("GET /api/benchmark/{job_id} after done", False, f"Missing field {field} in {stage} result")
                        return False
                        
            self.log_test("GET /api/benchmark/{job_id} after done", True, f"Status: done, Results: {list(results.keys())}")
            return True
            
        except Exception as e:
            self.log_test("GET /api/benchmark/{job_id} after done", False, f"Exception: {str(e)}")
            return False
            
    def test_job_cancellation(self) -> bool:
        """Test 7: Start job, cancel immediately, check status becomes cancelled"""
        try:
            # Start second job
            payload = {
                "target": "/data/ssdbench.test",
                "preset": "fast",
                "stages": ["seq_write"]
            }
            
            response = self.session.post(f"{BASE_URL}/api/benchmark/start", json=payload)
            if response.status_code != 200:
                self.log_test("Job cancellation - start", False, f"Start failed: {response.status_code}")
                return False
                
            job_id2 = response.json().get("job_id")
            if not job_id2:
                self.log_test("Job cancellation - start", False, "No job_id returned")
                return False
                
            self.job_ids.append(job_id2)
            
            # Cancel immediately
            cancel_response = self.session.post(f"{BASE_URL}/api/benchmark/{job_id2}/stop")
            if cancel_response.status_code != 200:
                self.log_test("Job cancellation - stop", False, f"Cancel failed: {cancel_response.status_code}")
                return False
                
            # Wait a bit and check status
            time.sleep(3)
            
            status_response = self.session.get(f"{BASE_URL}/api/benchmark/{job_id2}")
            if status_response.status_code != 200:
                self.log_test("Job cancellation - status", False, f"Status check failed: {status_response.status_code}")
                return False
                
            status_data = status_response.json()
            final_status = status_data.get("status")
            
            if final_status != "cancelled":
                self.log_test("Job cancellation", False, f"Expected 'cancelled', got: {final_status}")
                return False
                
            self.log_test("Job cancellation", True, f"Job {job_id2} successfully cancelled")
            return True
            
        except Exception as e:
            self.log_test("Job cancellation", False, f"Exception: {str(e)}")
            return False
            
    def test_history_endpoints(self) -> bool:
        """Test 8-10: History list, delete, export"""
        try:
            # Test GET /api/history
            response = self.session.get(f"{BASE_URL}/api/history")
            if response.status_code != 200:
                self.log_test("GET /api/history", False, f"Status code: {response.status_code}")
                return False
                
            data = response.json()
            if "items" not in data:
                self.log_test("GET /api/history", False, "Missing 'items' field")
                return False
                
            items = data["items"]
            if not isinstance(items, list) or len(items) == 0:
                self.log_test("GET /api/history", False, "No history items found")
                return False
                
            # Validate first item structure
            first_item = items[0]
            required_fields = ["id", "date", "disk", "type", "results", "score"]
            
            missing_fields = []
            for field in required_fields:
                if field not in first_item:
                    missing_fields.append(field)
                    
            if missing_fields:
                self.log_test("GET /api/history", False, f"Missing fields: {missing_fields}")
                return False
                
            self.log_test("GET /api/history", True, f"Found {len(items)} history items")
            
            # Test DELETE /api/history/{id}
            item_to_delete = first_item["id"]
            delete_response = self.session.delete(f"{BASE_URL}/api/history/{item_to_delete}")
            
            if delete_response.status_code != 200:
                self.log_test("DELETE /api/history/{id}", False, f"Status code: {delete_response.status_code}")
                return False
                
            # Verify item was deleted
            verify_response = self.session.get(f"{BASE_URL}/api/history")
            if verify_response.status_code == 200:
                verify_data = verify_response.json()
                remaining_items = verify_data.get("items", [])
                
                # Check if deleted item is gone
                deleted_item_found = any(item["id"] == item_to_delete for item in remaining_items)
                if deleted_item_found:
                    self.log_test("DELETE /api/history/{id}", False, "Item not actually deleted")
                    return False
                    
            self.log_test("DELETE /api/history/{id}", True, f"Deleted item {item_to_delete}")
            
            # Test GET /api/history/export
            export_response = self.session.get(f"{BASE_URL}/api/history/export")
            if export_response.status_code != 200:
                self.log_test("GET /api/history/export", False, f"Status code: {export_response.status_code}")
                return False
                
            export_data = export_response.json()
            if "items" not in export_data:
                self.log_test("GET /api/history/export", False, "Missing 'items' field in export")
                return False
                
            # Check Content-Disposition header
            content_disposition = export_response.headers.get("Content-Disposition")
            if not content_disposition or "attachment" not in content_disposition:
                self.log_test("GET /api/history/export", False, "Missing or invalid Content-Disposition header")
                return False
                
            self.log_test("GET /api/history/export", True, f"Export contains {len(export_data['items'])} items")
            return True
            
        except Exception as e:
            self.log_test("History endpoints", False, f"Exception: {str(e)}")
            return False
            
    def test_clear_test_file(self) -> bool:
        """Test 11: POST /api/benchmark/clear-test-file"""
        try:
            response = self.session.post(f"{BASE_URL}/api/benchmark/clear-test-file")
            
            if response.status_code != 200:
                self.log_test("POST /api/benchmark/clear-test-file", False, f"Status code: {response.status_code}")
                return False
                
            data = response.json()
            
            if "removed" not in data:
                self.log_test("POST /api/benchmark/clear-test-file", False, "Missing 'removed' field")
                return False
                
            if "path" not in data:
                self.log_test("POST /api/benchmark/clear-test-file", False, "Missing 'path' field")
                return False
                
            if data["path"] != "/data/ssdbench.test":
                self.log_test("POST /api/benchmark/clear-test-file", False, f"Wrong path: {data['path']}")
                return False
                
            self.log_test("POST /api/benchmark/clear-test-file", True, f"Removed: {data['removed']}, Path: {data['path']}")
            return True
            
        except Exception as e:
            self.log_test("POST /api/benchmark/clear-test-file", False, f"Exception: {str(e)}")
            return False
            
    def run_all_tests(self):
        """Run all tests in sequence"""
        print("🚀 Starting SSDBench Backend API Tests")
        print(f"Base URL: {BASE_URL}")
        print("=" * 60)
        
        # Test 1: Health check
        if not self.test_health_endpoint():
            return
            
        # Test 2: Disks endpoint
        if not self.test_disks_endpoint():
            return
            
        # Test 3: Meta endpoint
        if not self.test_meta_endpoint():
            return
            
        # Test 4: Start benchmark
        job_id = self.test_benchmark_start()
        if not job_id:
            return
            
        # Test 5: WebSocket events
        if not self.test_websocket_events(job_id):
            return
            
        # Test 6: Job status after completion
        if not self.test_job_status_after_done(job_id):
            return
            
        # Test 7: Job cancellation
        if not self.test_job_cancellation():
            return
            
        # Test 8-10: History endpoints
        if not self.test_history_endpoints():
            return
            
        # Test 11: Clear test file
        if not self.test_clear_test_file():
            return
            
        print("=" * 60)
        print("🎉 All tests completed!")
        
        # Summary
        passed = sum(1 for result in self.test_results if result["success"])
        total = len(self.test_results)
        
        print(f"📊 Results: {passed}/{total} tests passed")
        
        if passed == total:
            print("✅ ALL TESTS PASSED - SSDBench backend is working correctly!")
        else:
            print("❌ SOME TESTS FAILED - Check details above")
            
        return passed == total

if __name__ == "__main__":
    tester = SSDBenchTester()
    success = tester.run_all_tests()
    exit(0 if success else 1)