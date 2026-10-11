import copy
import unittest
from unittest.mock import patch
import deploy_ecs as deploy


class FrontendDeploymentTest(unittest.TestCase):
    def setUp(self):
        self.environment = {
            "FRONTEND_SERVICE_NAME": "legal-frontend", "BACKEND_SERVICE_NAME": "legal-backend",
            "ECS_CLUSTER": "LegalAdministrator", "IMAGE_URI": "registry/frontend:sha",
            "ECS_EXECUTION_ROLE_ARN": "arn:execution", "ECS_INFRASTRUCTURE_ROLE_ARN": "arn:infra",
            "ECS_SUBNET_IDS": "subnet-a,subnet-b", "FRONTEND_SECURITY_GROUP_IDS": "sg-frontend",
            "FRONTEND_URL": "https://frontend.example.com",
        }
        self.config = {"serviceRevisionArn": "revision-new", "primaryContainer": {
            "image": "backend:sha", "environment": [{"name": "OPTIONAL", "value": "keep"}],
            "secrets": [{"name": "DB_PASSWORD", "valueFrom": "arn:password"}]},
            "ingressPaths": [{"accessType": "PUBLIC", "endpoint": "https://backend.example.com"}]}
        self.service = {"serviceArn": "arn:service", "status": {"statusCode": "ACTIVE"},
                        "currentDeployment": "deployment-new", "activeConfigurations": [self.config]}

    def test_frontend_does_not_require_database_secrets_or_backend_task_role(self):
        with patch.dict(deploy.os.environ, self.environment, clear=True), patch.object(deploy, "find_service", return_value=None), patch.object(deploy, "submit") as submit:
            deploy.deploy("frontend")
            payload = submit.call_args.args[0]
            self.assertNotIn("taskRoleArn", payload)
            self.assertNotIn("secrets", payload["primaryContainer"])
            self.assertEqual(payload["primaryContainer"]["containerPort"], 8080)
            self.assertEqual(payload["healthCheckPath"], "/")

    def test_cors_update_preserves_backend_image_and_secrets(self):
        original = copy.deepcopy(self.service)
        with patch.dict(deploy.os.environ, self.environment, clear=True), patch.object(deploy, "find_service", return_value=self.service), patch.object(deploy, "submit") as submit:
            deploy.update_cors()
            container = submit.call_args.args[0]["primaryContainer"]
            self.assertEqual(container["image"], "backend:sha")
            self.assertEqual(container["secrets"], self.config["primaryContainer"]["secrets"])
            self.assertIn({"name": "FRONTEND_ALLOWED_ORIGINS", "value": self.environment["FRONTEND_URL"]}, container["environment"])
            self.assertEqual(self.service, original)

    def test_api_url_is_obtained_after_initial_backend_deployment(self):
        with patch.dict(deploy.os.environ, self.environment, clear=True), patch.object(deploy, "find_service", side_effect=[None, self.service]), patch.object(deploy.time, "sleep") as sleep:
            _, url = deploy.backend_url()
            self.assertEqual(url + "/api/v1", "https://backend.example.com/api/v1")
            sleep.assert_called_once()

    def test_old_success_does_not_complete_a_new_revision(self):
        responses = [{"service": self.service}, {"serviceDeployments": [{"targetServiceRevision": {"arn": "old"}, "status": "SUCCESSFUL"}]},
                     {"service": self.service}, {"serviceDeployments": [{"targetServiceRevision": {"arn": "revision-new"}, "status": "SUCCESSFUL"}]}]
        with patch.object(deploy, "aws", side_effect=responses), patch.object(deploy.time, "sleep") as sleep:
            deploy.wait_deployment("arn:service", "revision-new")
            sleep.assert_called_once()

    def test_rollback_fails_the_pipeline(self):
        with patch.object(deploy, "aws", side_effect=[{"service": self.service}, {"serviceDeployments": [{"targetServiceRevision": {"arn": "revision-new"}, "status": "ROLLBACK_SUCCESSFUL"}]}]):
            with self.assertRaisesRegex(RuntimeError, "ROLLBACK_SUCCESSFUL"):
                deploy.wait_deployment("arn:service", "revision-new")

    def test_cors_rejects_paths_and_plain_http(self):
        for url in ["http://frontend.example.com", "https://frontend.example.com/api", "https://user:pass@frontend.example.com"]:
            with self.assertRaises(ValueError):
                deploy.validate_origin(url)

    def test_cors_does_not_redeploy_when_the_origin_is_already_configured(self):
        for key in ["FRONTEND_ALLOWED_ORIGINS", "GOOGLE_FRONTEND_ORIGIN"]:
            self.config["primaryContainer"]["environment"].append({"name": key, "value": self.environment["FRONTEND_URL"]})
        with patch.dict(deploy.os.environ, self.environment, clear=True), patch.object(deploy, "find_service", return_value=self.service), patch.object(deploy, "submit") as submit:
            deploy.update_cors()
            submit.assert_not_called()


if __name__ == "__main__":
    unittest.main()
