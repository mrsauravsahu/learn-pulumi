import * as pulumi from "@pulumi/pulumi";
import * as azure from "@pulumi/azure";

// For setting the desired username and password for our VM.
const config = new pulumi.Config();
const username = config.require("username");
const password = config.requireSecret("password");

// Create an Azure Resource Group
const resourceGroup = new azure.core.ResourceGroup("basics-vm");

// VNet
const vnet = new azure.network.VirtualNetwork("vnetprimary", {
    resourceGroupName: resourceGroup.name,
    tags: {
        "Stage": "Dev"
    },
    addressSpaces: ['10.0.0.0/16'],
    subnets: [
        {
            name: 'default',
            addressPrefix: '10.0.1.0/24',
        }
    ]
});

const publicIp = new azure.network.PublicIp("publicip", {
    resourceGroupName: resourceGroup.name,
    allocationMethod: 'Dynamic'
})

const networkInterface = new azure.network.NetworkInterface("server-nic", {
    resourceGroupName: resourceGroup.name,
    ipConfigurations: [{
        name: "ipconfig",
        subnetId: vnet.subnets[0].id,
        privateIpAddressAllocation: "Dynamic",
        publicIpAddressId: publicIp.id,
    }],
});

const vm = new azure.compute.VirtualMachine("vm", {
    resourceGroupName: resourceGroup.name,
    networkInterfaceIds: [networkInterface.id],
    vmSize: 'Standard_A0',
    storageOsDisk: {
        createOption: "FromImage",
        name: 'myosdisk1'
    },
    storageImageReference: {
        publisher: "canonical",
        offer: "UbuntuServer",
        sku: "16.04-LTS",
        version: "latest",
    },
    osProfile: {
        computerName: "basics-vm",
        adminUsername: username,
        adminPassword: password,
    },
    osProfileLinuxConfig: {
        disablePasswordAuthentication: false,
    },
})

const done = pulumi.all({ _: vm.id, name: publicIp.name, resourceGroupName: publicIp.resourceGroupName });

export const ipAddress = done.apply(d => {
    return azure.network.getPublicIP({
        name: d.name,
        resourceGroupName: d.resourceGroupName,
    }, { async: true }).then(ip => ip.ipAddress);
});
