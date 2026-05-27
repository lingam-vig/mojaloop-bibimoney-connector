Mojaloop Harness Installation Log
Harness Type: SDK‑based Test Harness (with DFSP1, DFSP2, FXP1, Hub simulators)
Connector: Core Connector 1 & 2 (local containers)

Host: AWS EC2 (Ubuntu 22.04)

# Remove all stopped containers, unused images, networks, cache
Clean Docker completely

# Verify disk is clean
docker images
docker ps -a
df -h

# Clone fresh
cd ~/git
git clone https://github.com/pm4ml/cbs-core-connector-test-harness.git
cd cbs-core-connector-test-harness/sdk-based-test-harness

# Update the IP in docker-compose.yml
## we need to update the ip so we can access the url publicly also tehy can communicate

sed -i 's|http://localhost:15050|http://34.244.172.29:15050|g' docker-compose.yml
sed -i 's|http://localhost:25050|http://34.244.172.29:25050|g' docker-compose.yml
sed -i 's|http://localhost:45050|http://34.244.172.29:45050|g' docker-compose.yml
sed -i 's|http://localhost:55050|http://34.244.172.29:55050|g' docker-compose.yml

# Verify
grep "API_BASE_URL" docker-compose.yml

docker-compose --profile debug up -d

-- attached status_image1

# Check memory is healthy
free -h

# Watch containers come up
watch "docker ps --format \"table {{.Names}}\t{{.Status}}\""

-- attached status_image2

examples/environments/hub_local_environment.json

find the config json to update the default currency
find . -name "*.json" | grep -i environ

# run test
cd ~/git/cbs-core-connector-test-harness/sdk-based-test-harness

# Make the two changes to the test runner
sed -i 's|./config/ttk-dfsp1/environments:/opt/app/environments|./environments:/opt/app/environments|g' ttk-tests-docker-compose.yml

-- no need the below steps. just change the curreny in the config
sed -i 's|environments/hub_local_environment.json|environments/cc_golden_path_env_local.json|g' ttk-tests-docker-compose.yml

redo 
sed -i 's|cc_golden_path_env_local.json|cc_golden_path_env.json|g' ttk-tests-docker-compose.yml


# Verify both changes took effect
cat ttk-tests-docker-compose.yml

cat core-connector.env | grep -E "FSP_ID|CURRENCY|SDK_BASE"

# Restart core connector to pick up new env
docker-compose --profile debug up -d --force-recreate

# Run tests
docker-compose -f ./ttk-tests-docker-compose.yml up

50% pass

# Test done
need changing this falg to pass the test cases. we are not using multi

Check if there's a AUTO_ACCEPT_PARTY or AUTO_ACCEPT_QUOTES setting:

nano config/sdk-dfsp1/api-svc.env

### Run commans
docker-compose --profile debug up -d --force-recreate
docker-compose -f ./ttk-tests-docker-compose.yml up


# Rerun the test (NO restart required)

docker-compose -f ttk-tests-docker-compose.yml up --build ttk-tests


# Adding our core connector

cd ~/git
git clone https://github.com/lingam-vig/mojaloop-bibimoney-connector.git
cd mojaloop-bibimoney-connector
git checkout develop
ls

# BUild docker image
cd ~/git/mojaloop-bibimoney-connector/connector
docker build -t bibimoney-connector:latest .

# Verify
docker images | grep bibimoney

# Update our coreconnector image
cd ~/git/cbs-core-connector-test-harness/sdk-based-test-harness
nano core-connector.yaml

image: bibimoney-connector:latest

# BUild and run the core bank api (just for testing)

# Install .NET runtime on EC2
sudo apt-get update
sudo apt-get install -y dotnet-runtime-8.0

# Or install the full SDK if you need to build
sudo apt-get install -y dotnet-sdk-8.0

# if above wont work
wget https://packages.microsoft.com/config/ubuntu/22.04/packages-microsoft-prod.deb -O packages-microsoft-prod.deb
sudo dpkg -i packages-microsoft-prod.deb
rm packages-microsoft-prod.deb
sudo apt-get update
sudo apt-get install -y dotnet-runtime-8.0


# Clone/upload your .NET API repo
cd ~/git
git clone <your-dotnet-api-repo>
cd <your-dotnet-api>

# Run it
dotnet run --urls "http://0.0.0.0:5129"


#### Logs

docker-compose down
docker-compose up -d
docker-compose -f ./ttk-tests-docker-compose.yml up

docker logs sdk-based-test-harness-core-connector1-1 --tail 20
docker logs -f sdk-based-test-harness-core-connector1-1 &
docker logs sdk-based-test-harness-core-connector1-1 2>&1 | grep -E "parties|quoterequest|transfers|error|Error" | tail -30


##NOTES

Mojaloop has TWO outbound integration modes
Core Connector is running in “single‑integration mode”
you will ONLY see /send-money  not /parties, /quotes, or /transfers outbound.
"singleIntegrationMode": true


Outgoing P2P / P2B send-moneyCore bank initiates, not your connector